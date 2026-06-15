import * as fs from "node:fs";
import * as path from "node:path";
import type * as vscode from "vscode";
import * as ihsm from "ihsm";
import { DEFAULT_RAW } from "../config/schema";
import { makeMmkitHsm } from "../logging/hsm-factory";
import type { MmkitTraceWriter } from "../logging/trace";
import { ACTOR_IDS, ActorRegistry } from "../registry";
import type { MmkitPorts } from "../ports/types";
import type { StatusBarActorStates, StatusBarController } from "../ui/status-bar";
import { createClientManager } from "./client-manager";
import { createConfigActor } from "./config-actor";
import { createLanguageServerManager, type LanguageServerManagerCtx } from "./language-server-manager";
import { createPanelInteractionActor } from "./panel-interaction-actor";
import { applyTraceLevelChange } from "./trace-level-handler";
import type {
  ConfigSnapshot,
  FaultInfo,
  OperationalMode,
  OtelTraceLevel,
  PanelInteraction,
  RawMmkitSettings,
  ShutdownReason,
  ValidationError,
} from "../types";

const SHUTDOWN_WATCHDOG_MS = 15_000;

export interface ExtensionSupervisorCtx {
  ports: MmkitPorts;
  registry: ActorRegistry;
  trace: MmkitTraceWriter;
  vscode?: typeof vscode;
  extensionContext?: vscode.ExtensionContext;
  disposables: vscode.Disposable[];
  snapshot?: ConfigSnapshot;
  mode: OperationalMode;
  statusBar?: StatusBarController;
  shutdown?: {
    reason: ShutdownReason;
    deadline: number;
    pendingAcks: Set<string>;
    timer?: NodeJS.Timeout;
  };
  switchingTarget?: OperationalMode;
}

export interface ExtensionSupervisorProtocol {
  hostActivated(context: vscode.ExtensionContext): void;
  hostDeactivating(): void;
  hostConfigurationChanged(): void;
  hostCommand(commandId: string): void;
  hostSettingsPatch(patch: Partial<RawMmkitSettings>): void;
  snapshotPublished(snapshot: ConfigSnapshot): void;
  snapshotInvalid(errors: ValidationError[]): void;
  managerReportIdle(actorId: string): void;
  managerReportFault(report: FaultInfo): void;
  panelInteraction(interaction: PanelInteraction): void;
  childShutdownAck(actorId: string): void;
  shutdownWatchdogExpired(): void;
  traceLevelChanged(level: OtelTraceLevel): void;
  bootstrapActors(): void;
  applyModeFromSnapshot(): void;
  beginShutdownCascade(): void;
  refreshPanelStates(): void;
}

export class SupervisorTop extends ihsm.TopState<ExtensionSupervisorCtx, ExtensionSupervisorProtocol> {
  managerReportIdle(_actorId: string): void {}

  traceLevelChanged(level: OtelTraceLevel): void {
    applyTraceLevelChange(this.ctx.registry, this.ctx.trace, this.hsm, level);
    this.fanTraceLevel(level);
  }

  protected fanTraceLevel(level: OtelTraceLevel): void {
    this.postConfig("traceLevelChanged", level);
    this.postClient("traceLevelChanged", level);
    this.postLanguageServer("traceLevelChanged", level);
    this.postPanel("traceLevelChanged", level);
  }

  hostDeactivating(): void {
    this.transition(ShuttingDown);
  }

  protected postConfig(event: string, ...args: unknown[]): void {
    this.ctx.registry.postFrom(ACTOR_IDS.supervisor, ACTOR_IDS.config, event, ...args);
  }

  protected postClient(event: string, ...args: unknown[]): void {
    this.ctx.registry.postFrom(ACTOR_IDS.supervisor, ACTOR_IDS.client, event, ...args);
  }

  protected postLanguageServer(event: string, ...args: unknown[]): void {
    this.ctx.registry.postFrom(ACTOR_IDS.supervisor, ACTOR_IDS.languageServer, event, ...args);
  }

  protected postPanel(event: string, ...args: unknown[]): void {
    this.ctx.registry.postFrom(ACTOR_IDS.supervisor, ACTOR_IDS.panel, event, ...args);
  }

  protected languageServerCtx(): LanguageServerManagerCtx | undefined {
    return this.ctx.registry.get(ACTOR_IDS.languageServer)?.ctx as LanguageServerManagerCtx | undefined;
  }

  protected applyModeSideEffects(mode: OperationalMode): void {
    const snapshot = this.ctx.snapshot;
    if (!snapshot) return;
    this.ctx.trace.debug(this.hsm, `apply mode side effects`, { mode });
    if (mode === "internalServer") {
      this.postPanel("enable", snapshot, this.currentLeafStates().server, this.currentLeafStates().client);
      this.refreshStatusBar();
      return;
    }
    if (mode === "client") {
      this.postClient("enable", snapshot);
      this.postPanel("enable", snapshot, this.currentLeafStates().server, this.currentLeafStates().client);
      this.refreshStatusBar();
      return;
    }
    this.postClient("disable");
    this.postPanel("disable");
    this.refreshStatusBar();
  }

  protected currentLeafStates(): { server?: string; client?: string } {
    const lsCtx = this.languageServerCtx();
    return {
      server: lsCtx?.mmkitServerPanelState ?? "Idle",
      client: this.ctx.registry.get(ACTOR_IDS.client)?.currentStateName,
    };
  }

  protected statusBarStates(): StatusBarActorStates {
    const lsCtx = this.languageServerCtx();
    return {
      mode: this.ctx.mode,
      server: lsCtx?.mmkitServerPanelState ?? "Idle",
      client: this.ctx.registry.get(ACTOR_IDS.client)?.currentStateName,
      languageServer: this.ctx.registry.get(ACTOR_IDS.languageServer)?.currentStateName,
      supervisor: this.hsm.currentStateName,
    };
  }

  protected refreshStatusBar(): void {
    this.ctx.statusBar?.update(this.statusBarStates(), this.ctx.snapshot);
  }

  protected applySnapshotTraceLevel(snapshot: ConfigSnapshot): void {
    this.ctx.registry.applyTraceLevel(snapshot.traceLevel);
    this.fanTraceLevel(snapshot.traceLevel);
  }

  refreshPanelStates(): void {
    const states = this.currentLeafStates();
    this.postPanel("managerStateUpdated", states.server, states.client);
  }
}

@ihsm.InitialState
export class Inactive extends SupervisorTop {
  hostActivated(context: vscode.ExtensionContext): void {
    this.ctx.extensionContext = context;
    this.ctx.statusBar?.showImmediately();
    this.refreshStatusBar();
    this.transition(Bootstrapping);
  }

  shutdownWatchdogExpired(): void {}
}

export class Bootstrapping extends SupervisorTop {
  onEntry(): void {
    this.postNow("bootstrapActors");
  }

  snapshotPublished(snapshot: ConfigSnapshot): void {
    this.ctx.snapshot = snapshot;
    this.applySnapshotTraceLevel(snapshot);
    this.transition(Active);
    this.postLanguageServer("snapshotUpdated", snapshot);
    this.post("applyModeFromSnapshot");
    this.refreshStatusBar();
  }

  bootstrapActors(): void {
    const { ports, registry, trace } = this.ctx;
    trace.info("bootstrapping child actors");
    const config = createConfigActor({
      ports,
      registry,
      trace: registry.actorTrace(ACTOR_IDS.config),
      generation: 0,
      validationErrors: [],
      shutdownRequested: false,
    });
    const client = createClientManager({
      ports,
      registry,
      trace: registry.actorTrace(ACTOR_IDS.client),
      enabled: false,
      clientName: '""',
      serverName: '""',
      shutdownRequested: false,
      disableAfterStop: false,
    });
    const panel = createPanelInteractionActor({
      ports,
      registry,
      trace: registry.actorTrace(ACTOR_IDS.panel),
      traceLevel: DEFAULT_RAW.traceLevel,
      shutdownRequested: false,
    });
    const languageServer = createLanguageServerManager({
      registry,
      trace: registry.actorTrace(ACTOR_IDS.languageServer),
      extensionContext: this.ctx.extensionContext!,
      enabled: false,
      shutdownRequested: false,
      mmkitServerPanelState: "Idle",
    });
    registry.register(ACTOR_IDS.config, config as ihsm.Hsm<unknown, Record<string, unknown>>);
    registry.register(ACTOR_IDS.client, client as ihsm.Hsm<unknown, Record<string, unknown>>);
    registry.register(ACTOR_IDS.languageServer, languageServer as ihsm.Hsm<unknown, Record<string, unknown>>);
    registry.register(ACTOR_IDS.panel, panel as ihsm.Hsm<unknown, Record<string, unknown>>);
    this.postConfig("reloadFromHost");
    if (shouldEnableLanguageServer(this.ctx.extensionContext)) {
      this.postLanguageServer("enable");
    }
    this.refreshStatusBar();
  }
}

export class Active extends SupervisorTop {
  hostConfigurationChanged(): void {
    this.postConfig("reloadFromHost");
  }

  hostSettingsPatch(patch: Partial<RawMmkitSettings>): void {
    this.postConfig("settingsPatch", patch);
  }

  hostCommand(commandId: string): void {
    this.dispatchCommand(commandId);
  }

  panelInteraction(interaction: PanelInteraction): void {
    if (interaction.kind === "click") {
      this.dispatchCommand(`mmkit.${interaction.actionId}`);
      return;
    }
    this.ctx.trace.debug(this.hsm, "panel keydown", { key: interaction.key, actionId: interaction.actionId });
  }

  private dispatchCommand(commandId: string): void {
    switch (commandId) {
      case "mmkit.startServer":
        this.postLanguageServer("userStartServer");
        break;
      case "mmkit.stopServer":
        this.postLanguageServer("userStopServer");
        break;
      case "mmkit.connect":
        this.postClient("userConnect");
        break;
      case "mmkit.disconnect":
        this.postClient("userDisconnect");
        break;
      case "mmkit.openSettings":
        void this.ctx.vscode?.commands.executeCommand("workbench.action.openSettings", "@ext:conceptbase.mmkit");
        break;
      case "mmkit.restartLanguageServer":
        this.postLanguageServer("userRestart");
        break;
      default:
        break;
    }
    this.postNow("refreshPanelStates");
  }

  snapshotPublished(snapshot: ConfigSnapshot): void {
    this.ctx.snapshot = snapshot;
    this.applySnapshotTraceLevel(snapshot);
    this.postClient("snapshotUpdated", snapshot);
    this.postLanguageServer("snapshotUpdated", snapshot);
    this.postPanel("snapshotUpdated", snapshot);
    this.postNow("applyModeFromSnapshot");
    this.refreshStatusBar();
    this.postNow("refreshPanelStates");
  }

  snapshotInvalid(errors: ValidationError[]): void {
    const message = errors.map((e) => `${e.field}: ${e.message}`).join("; ");
    void this.ctx.vscode?.window.showErrorMessage(`mmkit configuration invalid: ${message}`);
    this.postNow("refreshPanelStates");
  }

  managerReportFault(report: FaultInfo): void {
    void this.ctx.vscode?.window.showErrorMessage(`mmkit ${report.actorId}: ${report.message}`);
    this.refreshStatusBar();
    this.postNow("refreshPanelStates");
  }

  managerReportIdle(actorId: string): void {
    if (actorId === ACTOR_IDS.client || actorId === ACTOR_IDS.languageServer) {
      this.refreshStatusBar();
      this.postNow("refreshPanelStates");
    }
  }

  applyModeFromSnapshot(): void {
    const target = this.ctx.snapshot?.operationalMode ?? "none";
    if (target === this.ctx.mode) {
      this.applyModeSideEffects(target);
      return;
    }
    if (this.ctx.mode === "none") {
      this.ctx.mode = target;
      this.applyModeSideEffects(target);
      return;
    }
    this.ctx.switchingTarget = target;
    if (this.ctx.mode === "client") {
      this.postClient("disable");
      this.transition(SwitchingMode);
    } else {
      this.ctx.mode = target;
      this.applyModeSideEffects(target);
      this.transition(Active);
    }
  }
}

export class SwitchingMode extends SupervisorTop {
  managerReportIdle(actorId: string): void {
    if (actorId !== ACTOR_IDS.client) return;
    const target = this.ctx.switchingTarget ?? "none";
    this.ctx.mode = target;
    this.ctx.switchingTarget = undefined;
    this.applyModeSideEffects(target);
    this.transition(Active);
    this.postNow("refreshPanelStates");
  }
}

export class ShuttingDown extends SupervisorTop {
  onEntry(): void {
    this.postNow("beginShutdownCascade");
  }

  beginShutdownCascade(): void {
    const pending = new Set<string>([
      ACTOR_IDS.config,
      ACTOR_IDS.client,
      ACTOR_IDS.languageServer,
      ACTOR_IDS.panel,
    ]);
    this.ctx.shutdown = {
      reason: "deactivate",
      deadline: Date.now() + SHUTDOWN_WATCHDOG_MS,
      pendingAcks: pending,
      timer: setTimeout(() => this.postNow("shutdownWatchdogExpired"), SHUTDOWN_WATCHDOG_MS),
    };
    this.postClient("shutdownRequested");
    this.postLanguageServer("shutdownRequested");
    this.postConfig("shutdownRequested");
    this.postPanel("shutdownRequested");
  }

  childShutdownAck(actorId: string): void {
    this.ctx.trace.debug(this.hsm, `shutdown ack`, { actorId, pending: this.ctx.shutdown?.pendingAcks.size });
    this.ctx.shutdown?.pendingAcks.delete(actorId);
    if (this.ctx.shutdown && this.ctx.shutdown.pendingAcks.size === 0) {
      this.finishShutdown();
    }
  }

  shutdownWatchdogExpired(): void {
    this.postClient("shutdownForce");
    this.postLanguageServer("shutdownForce");
    this.postConfig("shutdownForce");
    this.postPanel("shutdownForce");
    this.finishShutdown();
  }

  private finishShutdown(): void {
    if (this.ctx.shutdown?.timer) {
      clearTimeout(this.ctx.shutdown.timer);
    }
    for (const d of this.ctx.disposables) {
      d.dispose();
    }
    this.ctx.disposables.length = 0;
    this.ctx.registry.clear();
    this.ctx.statusBar?.dispose();
    this.transition(Inactive);
  }
}

ihsm.registerStateNames({
  Inactive,
  Bootstrapping,
  Active,
  SwitchingMode,
  ShuttingDown,
});

export function createExtensionSupervisor(ctx: ExtensionSupervisorCtx): ihsm.Hsm<ExtensionSupervisorCtx, ExtensionSupervisorProtocol> {
  return makeMmkitHsm(SupervisorTop, ctx);
}

/** Start LSP eagerly in dev/production and in VS Code integration tests (bundled `server/server.js`). */
export function shouldEnableLanguageServer(context?: vscode.ExtensionContext): boolean {
  if (!context) return false;
  // vscode.ExtensionMode.Test === 3 (avoid runtime `import 'vscode'` in unit tests).
  if (context.extensionMode !== 3) return true;
  try {
    const serverModule = context.asAbsolutePath(path.join("server", "server.js"));
    return fs.existsSync(serverModule);
  } catch {
    return false;
  }
}
