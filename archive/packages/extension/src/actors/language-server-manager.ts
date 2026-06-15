import type * as vscode from "vscode";
import * as ihsm from "ihsm";
import { makeMmkitHsm } from "../logging/hsm-factory";
import type { MmkitTraceWriter } from "../logging/trace";
import type { ConfigActorCtx } from "./config-actor";
import type { ActorRegistry } from "../registry";
import { ACTOR_IDS } from "../registry";
import type { ConfigSnapshot, OtelTraceLevel } from "../types";

export interface LanguageServerManagerCtx {
  registry: ActorRegistry;
  trace: MmkitTraceWriter;
  extensionContext: vscode.ExtensionContext;
  snapshot?: ConfigSnapshot;
  enabled: boolean;
  shutdownRequested: boolean;
  mmkitServerPanelState: string;
}

export interface LanguageServerManagerProtocol {
  enable(snapshot?: ConfigSnapshot): void;
  snapshotUpdated(snapshot: ConfigSnapshot): void;
  userRestart(): void;
  userStartServer(): void;
  userStopServer(): void;
  mmkitServerStateUpdated(panelState: string): void;
  shutdownRequested(): void;
  shutdownForce(): void;
  beginStart(): void;
  beginStop(): void;
  pushConfigToServer(): void;
  traceLevelChanged(level: OtelTraceLevel): void;
}

export class LanguageServerTop extends ihsm.TopState<LanguageServerManagerCtx, LanguageServerManagerProtocol> {
  traceLevelChanged(level: OtelTraceLevel): void {
    this.ctx.trace.info("trace level changed", { level, state: this.hsm.currentStateName });
  }

  protected reportFault(message: string): void {
    this.ctx.trace.warn(message, { state: this.hsm.currentStateName, event: this.hsm.eventName });
    this.ctx.registry.postFrom(ACTOR_IDS.languageServer, ACTOR_IDS.supervisor, "managerReportFault", {
      actorId: ACTOR_IDS.languageServer,
      message,
    });
  }

  protected debug(message: string, detail?: unknown): void {
    this.ctx.trace.debug(this.hsm, message, detail);
  }

  snapshotUpdated(snapshot: ConfigSnapshot): void {
    this.ctx.snapshot = snapshot;
    this.postNow("pushConfigToServer");
    this.maybeAutoStartServer();
  }

  protected notifySupervisor(): void {
    this.ctx.registry.postFrom(
      ACTOR_IDS.languageServer,
      ACTOR_IDS.supervisor,
      "managerReportIdle",
      ACTOR_IDS.languageServer
    );
  }

  async pushConfigToServer(): Promise<void> {
    const snapshot = this.latestSnapshot();
    if (!snapshot) return;
    try {
      const { pushConfigToLanguageServer } = await import("../lsp/client");
      await pushConfigToLanguageServer(snapshot);
    } catch (err) {
      this.debug("config push to LSP failed", { error: String(err) });
    }
  }

  mmkitServerStateUpdated(panelState: string): void {
    this.ctx.mmkitServerPanelState = panelState;
    this.ctx.registry.postFrom(
      ACTOR_IDS.languageServer,
      ACTOR_IDS.supervisor,
      "managerReportIdle",
      ACTOR_IDS.languageServer
    );
  }

  /** Ignored unless overridden in `Running` — prevents FatalError on early start/stop. */
  userStartServer(): void {
    this.debug("userStartServer ignored — language server not ready", { state: this.hsm.currentStateName });
  }

  userStopServer(): void {
    this.debug("userStopServer ignored — language server not ready", { state: this.hsm.currentStateName });
  }

  protected latestSnapshot(): ConfigSnapshot | undefined {
    const configCtx = this.ctx.registry.get(ACTOR_IDS.config)?.ctx as ConfigActorCtx | undefined;
    return configCtx?.snapshot ?? this.ctx.snapshot;
  }

  protected maybeAutoStartServer(): void {
    const snapshot = this.latestSnapshot();
    if (!snapshot?.valid || snapshot.operationalMode !== "internalServer" || !snapshot.server.autoStartup) {
      return;
    }
    const phase = this.ctx.mmkitServerPanelState;
    if (phase === "Running" || phase === "Starting" || phase === "Installing") {
      return;
    }
    void this.userStartServer();
  }
}

@ihsm.InitialState
export class Disabled extends LanguageServerTop {
  onEntry(): void {
    this.debug("language server disabled");
    this.notifySupervisor();
  }

  enable(snapshot?: ConfigSnapshot): void {
    this.ctx.enabled = true;
    if (snapshot) {
      this.ctx.snapshot = snapshot;
    }
    this.transition(Starting);
  }

  shutdownRequested(): void {
    this.ctx.registry.postFrom(ACTOR_IDS.languageServer, ACTOR_IDS.supervisor, "childShutdownAck", ACTOR_IDS.languageServer);
  }

  shutdownForce(): void {
    this.shutdownRequested();
  }
}

export class Starting extends LanguageServerTop {
  onEntry(): void {
    this.notifySupervisor();
    this.postNow("beginStart");
  }

  async beginStart(): Promise<void> {
    try {
      const { startLanguageClient, setMmkitServerStateListener } = await import("../lsp/client");
      const { panelStateFromPhase } = await import("../lsp/mmkit-lsp-bridge");
      setMmkitServerStateListener((notification) => {
        this.post("mmkitServerStateUpdated", panelStateFromPhase(notification.phase));
      });
      await startLanguageClient(this.ctx.extensionContext);
      if (this.ctx.snapshot) {
        await this.pushConfigToServer();
      }
      if (this.ctx.shutdownRequested) {
        this.transition(Stopping);
        return;
      }
      this.transition(Running);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.reportFault(`ConceptBase LSP failed to start — ${message}`);
      if (this.ctx.shutdownRequested) {
        this.transition(ShuttingDown);
        return;
      }
      this.transition(Disabled);
    }
  }

  shutdownRequested(): void {
    this.ctx.shutdownRequested = true;
    this.transition(Stopping);
  }

  shutdownForce(): void {
    this.ctx.shutdownRequested = true;
    this.transition(ShuttingDown);
  }
}

export class Running extends LanguageServerTop {
  onEntry(): void {
    this.notifySupervisor();
    this.maybeAutoStartServer();
  }

  userRestart(): void {
    this.transition(Restarting);
  }

  async userStartServer(): Promise<void> {
    const snapshot = this.latestSnapshot();
    if (!snapshot?.valid) {
      this.reportFault("Cannot start mmkit server: invalid configuration");
      return;
    }
    try {
      const { requestMmkitServerStart } = await import("../lsp/client");
      await requestMmkitServerStart(snapshot);
    } catch (err) {
      this.reportFault(`mmkit server start failed — ${String(err)}`);
    }
  }

  async userStopServer(): Promise<void> {
    try {
      const { requestMmkitServerStop } = await import("../lsp/client");
      await requestMmkitServerStop();
    } catch (err) {
      this.reportFault(`mmkit server stop failed — ${String(err)}`);
    }
  }

  shutdownRequested(): void {
    this.ctx.shutdownRequested = true;
    this.transition(Stopping);
  }

  shutdownForce(): void {
    this.ctx.shutdownRequested = true;
    this.transition(ShuttingDown);
  }
}

export class Restarting extends LanguageServerTop {
  onEntry(): void {
    this.notifySupervisor();
    this.postNow("beginStop");
  }

  async beginStop(): Promise<void> {
    try {
      const { stopLanguageClient, setMmkitServerStateListener } = await import("../lsp/client");
      setMmkitServerStateListener(undefined);
      await stopLanguageClient();
    } catch (err) {
      this.debug("LSP stop during restart failed", { error: String(err) });
    }
    if (this.ctx.shutdownRequested) {
      this.transition(ShuttingDown);
      return;
    }
    this.transition(Starting);
  }

  shutdownRequested(): void {
    this.ctx.shutdownRequested = true;
    this.transition(Stopping);
  }

  shutdownForce(): void {
    this.ctx.shutdownRequested = true;
    this.transition(ShuttingDown);
  }
}

export class Stopping extends LanguageServerTop {
  onEntry(): void {
    this.notifySupervisor();
    this.postNow("beginStop");
  }

  async beginStop(): Promise<void> {
    try {
      const { stopLanguageClient, setMmkitServerStateListener } = await import("../lsp/client");
      setMmkitServerStateListener(undefined);
      await stopLanguageClient();
    } catch (err) {
      this.debug("LSP stop failed", { error: String(err) });
    }
    if (this.ctx.shutdownRequested) {
      this.transition(ShuttingDown);
      return;
    }
    this.ctx.enabled = false;
    this.transition(Disabled);
  }

  shutdownForce(): void {
    this.ctx.shutdownRequested = true;
    this.transition(ShuttingDown);
  }
}

export class ShuttingDown extends LanguageServerTop {
  onEntry(): void {
    this.notifySupervisor();
    this.postNow("beginStop");
  }

  async beginStop(): Promise<void> {
    try {
      const { stopLanguageClient, setMmkitServerStateListener } = await import("../lsp/client");
      setMmkitServerStateListener(undefined);
      await stopLanguageClient();
    } catch (err) {
      this.debug("LSP shutdown stop failed", { error: String(err) });
    }
    this.ctx.enabled = false;
    this.ctx.registry.postFrom(ACTOR_IDS.languageServer, ACTOR_IDS.supervisor, "childShutdownAck", ACTOR_IDS.languageServer);
  }

  shutdownForce(): void {
    this.beginStop();
  }
}

ihsm.registerStateNames({
  Disabled,
  Starting,
  Running,
  Restarting,
  Stopping,
  ShuttingDown,
});

export function createLanguageServerManager(
  ctx: LanguageServerManagerCtx
): ihsm.Hsm<LanguageServerManagerCtx, LanguageServerManagerProtocol> {
  return makeMmkitHsm(LanguageServerTop, ctx);
}
