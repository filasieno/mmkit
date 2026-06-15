import type {
  ConfigSnapshotPayload,
  MmkitConfigUpdateParams,
  MmkitConfigUpdateResult,
  MmkitServerStartParams,
  MmkitServerStartResult,
  MmkitServerState,
  MmkitServerStateNotification,
  OtelEndpointConfig,
  OtelTestResult,
} from "@mmkit/shared";
import { MMKIT_LSP_METHODS } from "@mmkit/shared";
import type { Connection } from "vscode-languageserver/node";
import type { LspActuators } from "../../lsp/ports/lsp-actuators";
import type { MmkitServerPorts } from "../../shared/ports/types";
import { createMmkitServerActor } from "../mmkit-server/mmkit-server-actor.hsm";
import type { ServerNotifier } from "../mmkit-server/server-notifier";
import { CustomHandlerRegistry } from "./custom-handler-registry";

const MMKIT_PROGRESS_TOKEN = "mmkit-server-install";

export interface ServerSupervisorOptions {
  ports: MmkitServerPorts;
  registry: CustomHandlerRegistry;
  getConnection: () => Connection | undefined;
  getActuators: () => LspActuators | undefined;
}

export class ServerSupervisor {
  private snapshot?: ConfigSnapshotPayload;
  private generation = 0;
  private readonly actor;
  private progressVisible = false;

  constructor(private readonly options: ServerSupervisorOptions) {
    const notifier: ServerNotifier = {
      emitState: (n) => this.emitState(n),
      reportInstallProgress: (message, percent) => this.reportProgress(message, percent),
      showInstallProgress: (title) => this.showProgress(title),
      hideInstallProgress: () => this.hideProgress(),
    };

    this.actor = createMmkitServerActor({
      ports: options.ports,
      notifier,
      shutdownRequested: false,
      progressVisible: false,
    });
  }

  start(): void {
    this.registerHandlers();
  }

  getState(): MmkitServerState {
    const phase = this.actor.currentStateName;
    return {
      phase: mapActorStateToPhase(phase),
      port: this.snapshot?.server.port,
      generation: this.generation,
    };
  }

  async shutdown(): Promise<void> {
    this.actor.post("shutdownRequested");
    await this.actor.sync();
  }

  private registerHandlers(): void {
    const { registry } = this.options;
    registry.register(MMKIT_LSP_METHODS.serverStart, (p) => this.handleStart(p as MmkitServerStartParams));
    registry.register(MMKIT_LSP_METHODS.serverStop, () => this.handleStop());
    registry.register(MMKIT_LSP_METHODS.serverRestart, (p) => this.handleRestart(p as MmkitServerStartParams));
    registry.register(MMKIT_LSP_METHODS.serverStatus, async () => this.getState());
    registry.register(MMKIT_LSP_METHODS.configUpdate, (p) => this.handleConfigUpdate(p as MmkitConfigUpdateParams));
    registry.register(MMKIT_LSP_METHODS.otelTest, (p) => this.handleOtelTest(p as OtelEndpointConfig));
  }

  private async handleStart(params: MmkitServerStartParams): Promise<MmkitServerStartResult> {
    if (!params.snapshot.valid) {
      return {
        ok: false,
        state: this.getState(),
        errors: params.snapshot.errors,
      };
    }
    this.snapshot = params.snapshot;
    this.generation = params.generation;
    this.actor.post("userStart", params.snapshot, params.generation);
    await this.actor.sync();
    return { ok: true, state: this.getState() };
  }

  private async handleStop(): Promise<{ ok: boolean }> {
    this.actor.post("userStop");
    await this.actor.sync();
    return { ok: true };
  }

  private async handleRestart(params: MmkitServerStartParams): Promise<MmkitServerStartResult> {
    this.actor.post("userStop");
    await this.actor.sync();
    return this.handleStart(params);
  }

  private async handleConfigUpdate(params: MmkitConfigUpdateParams): Promise<MmkitConfigUpdateResult> {
    this.snapshot = params.snapshot;
    this.generation = params.snapshot.generation;
    this.actor.post("snapshotUpdated", params.snapshot);
    await this.actor.sync();
    return { generation: this.generation };
  }

  private async handleOtelTest(config: OtelEndpointConfig): Promise<OtelTestResult> {
    const started = Date.now();
    try {
      const url = `${config.protocol === "grpc" ? "http" : config.protocol}://${config.host}:${config.port}`;
      const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(3000) });
      return {
        ok: res.ok || res.status < 500,
        message: res.ok ? "collector reachable" : `HTTP ${res.status}`,
        latencyMs: Date.now() - started,
      };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : String(err),
        latencyMs: Date.now() - started,
      };
    }
  }

  private emitState(notification: MmkitServerStateNotification): void {
    const conn = this.options.getConnection();
    if (conn) {
      void conn.sendNotification(MMKIT_LSP_METHODS.serverStateNotification, notification);
    }
    const actuators = this.options.getActuators();
    if (actuators && notification.message) {
      actuators.consoleInfo(`[mmkit-server] ${notification.phase}: ${notification.message}`);
    }
  }

  private showProgress(title: string): void {
    const actuators = this.options.getActuators();
    if (!actuators || this.progressVisible) return;
    actuators.beginWorkDone(MMKIT_PROGRESS_TOKEN, title, false);
    this.progressVisible = true;
  }

  private reportProgress(message: string, percent: number): void {
    const actuators = this.options.getActuators();
    if (!actuators) return;
    if (!this.progressVisible) {
      this.showProgress("Starting mmkit server");
    }
    actuators.reportWorkDone(MMKIT_PROGRESS_TOKEN, message, percent);
  }

  private hideProgress(): void {
    const actuators = this.options.getActuators();
    if (!actuators || !this.progressVisible) return;
    actuators.endWorkDone(MMKIT_PROGRESS_TOKEN);
    this.progressVisible = false;
  }
}

function mapActorStateToPhase(stateName: string): MmkitServerState["phase"] {
  if (stateName === "Running") return "running";
  if (stateName === "Idle") return "idle";
  if (stateName === "Stopping" || stateName === "ShuttingDown") return "stopping";
  if (stateName === "Starting") return "starting";
  if (stateName.startsWith("Installing")) return "installing";
  return "fault";
}
