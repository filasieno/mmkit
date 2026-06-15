import * as ihsm from "ihsm";
import {
  FAST_START_THRESHOLD_MS,
  type ConfigSnapshotPayload,
  type InstallStep,
  type OtelTraceLevel,
} from "@mmkit/shared";
import type { MmkitServerPorts } from "../../shared/ports/types";
import { createLspHsm } from "../../lsp/lsp-hsm-factory";
import { buildLaunchSpec } from "./launch-spec";
import { percentWithinStep } from "./install/progress";
import { phaseFromStateName, type ServerNotifier } from "./server-notifier";

export interface MmkitServerActorCtx {
  ports: MmkitServerPorts;
  notifier: ServerNotifier;
  snapshot?: ConfigSnapshotPayload;
  pid?: number;
  containerName?: string;
  exitUnsubscribe?: () => void;
  shutdownRequested: boolean;
  startRequestedAt?: number;
  progressVisible: boolean;
  fastStartTimer?: ReturnType<typeof setTimeout>;
  generation?: number;
}

export interface MmkitServerActorProtocol {
  userStart(snapshot: ConfigSnapshotPayload, generation: number): void;
  userStop(): void;
  snapshotUpdated(snapshot: ConfigSnapshotPayload): void;
  processExited(code: number | null): void;
  portReady(): void;
  installFailed(error: string): void;
  fastStartThresholdElapsed(): void;
  shutdownRequested(): void;
  installPrepare(): void;
  installMaterializeAssets(): void;
  installEnsureDockerImage(): void;
  installLaunchContainer(): void;
  installAwaitPort(): void;
  installFailureTeardown(): void;
  beginInstallPipeline(): void;
  beginStop(): void;
  traceLevelChanged(level: OtelTraceLevel): void;
}

export class ServerTop extends ihsm.TopState<MmkitServerActorCtx, MmkitServerActorProtocol> {
  traceLevelChanged(_level: OtelTraceLevel): void {}

  protected emitState(message?: string, fault?: string): void {
    const phase = phaseFromStateName(this.hsm.currentStateName);
    this.ctx.notifier.emitState({
      phase,
      port: this.ctx.snapshot?.server.port,
      message,
      fault,
      generation: this.ctx.generation,
    });
  }

  protected reportInstallProgress(message: string, percent: number): void {
    this.ctx.notifier.reportInstallProgress(message, percent);
  }

  protected reportInstallStep(step: InstallStep, fraction: number, message: string): void {
    const percent = percentWithinStep(step, fraction);
    this.reportProgress(message, percent);
  }

  protected reportProgress(message: string, percent: number): void {
    this.maybeShowSlowStartProgress();
    this.reportInstallProgress(message, percent);
  }

  protected hideProgressIfVisible(): void {
    if (this.ctx.progressVisible) {
      this.ctx.notifier.hideInstallProgress();
      this.ctx.progressVisible = false;
    }
  }

  protected isInstallInFlight(): boolean {
    const state = this.hsm.currentStateName;
    return state === "Starting" || state.startsWith("Installing");
  }

  protected maybeShowSlowStartProgress(): void {
    if (this.ctx.progressVisible || !this.isInstallInFlight()) return;
    const startedAt = this.ctx.startRequestedAt;
    if (startedAt === undefined || Date.now() - startedAt < FAST_START_THRESHOLD_MS) return;
    this.ctx.notifier.showInstallProgress("Starting mmkit server");
    this.ctx.progressVisible = true;
    this.ctx.notifier.reportInstallProgress("Preparing mmkit server…", 0);
  }

  protected armFastStartWatchdog(): void {
    this.clearFastStartWatchdog();
    this.ctx.startRequestedAt = Date.now();
    this.ctx.fastStartTimer = setTimeout(() => {
      this.ctx.fastStartTimer = undefined;
      this.post("fastStartThresholdElapsed");
    }, FAST_START_THRESHOLD_MS);
  }

  protected clearFastStartWatchdog(): void {
    if (this.ctx.fastStartTimer === undefined) return;
    clearTimeout(this.ctx.fastStartTimer);
    this.ctx.fastStartTimer = undefined;
  }

  protected async tearDownServer(): Promise<void> {
    this.hideProgressIfVisible();
    this.ctx.exitUnsubscribe?.();
    this.ctx.exitUnsubscribe = undefined;
    if (this.ctx.containerName) {
      try {
        await this.ctx.ports.docker.stop(this.ctx.containerName);
      } catch {
        // best effort
      }
      this.ctx.containerName = undefined;
    }
    if (this.ctx.pid !== undefined) {
      try {
        await this.ctx.ports.process.kill(this.ctx.pid);
      } catch {
        // best effort
      }
      this.ctx.pid = undefined;
    }
    if (this.ctx.shutdownRequested) {
      if (this.hsm.currentStateName !== "ShuttingDown") {
        this.transition(ShuttingDown);
      }
      return;
    }
    this.transition(Idle);
  }

  snapshotUpdated(snapshot: ConfigSnapshotPayload): void {
    this.ctx.snapshot = snapshot;
  }

  fastStartThresholdElapsed(): void {
    this.clearFastStartWatchdog();
    this.maybeShowSlowStartProgress();
  }

  userStart(snapshot: ConfigSnapshotPayload, generation: number): void {
    this.ctx.snapshot = snapshot;
    this.ctx.generation = generation;
    if (!snapshot.valid) {
      this.emitState(undefined, "Cannot start server: invalid configuration");
      return;
    }
    this.transition(Starting);
  }

  userStop(): void {
    this.transition(Stopping);
  }

  shutdownRequested(): void {
    this.ctx.shutdownRequested = true;
    this.transition(Stopping);
  }

  protected delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

@ihsm.InitialState
export class Idle extends ServerTop {
  onEntry(): void {
    this.clearFastStartWatchdog();
    this.hideProgressIfVisible();
    this.emitState("mmkit server idle");
  }

  userStart(snapshot: ConfigSnapshotPayload, generation: number): void {
    this.ctx.snapshot = snapshot;
    this.ctx.generation = generation;
    if (!snapshot.valid) {
      this.emitState(undefined, "Cannot start server: invalid configuration");
      return;
    }
    this.transition(Starting);
  }

  userStop(): void {}
}

export class Starting extends ServerTop {
  onEntry(): void {
    this.emitState("Starting mmkit server");
    this.armFastStartWatchdog();
    this.postNow("beginInstallPipeline");
  }

  beginInstallPipeline(): void {
    this.reportInstallStep("prepare", 0, "Starting mmkit server installation…");
    this.transition(InstallingPrepare);
  }
}

export class Installing extends ServerTop {
  protected requireSnapshot(): ConfigSnapshotPayload | undefined {
    const snapshot = this.ctx.snapshot;
    if (!snapshot) {
      this.postNow("installFailed", "missing configuration snapshot");
      return undefined;
    }
    return snapshot;
  }

  installFailed(error: string): void {
    this.emitState(undefined, error);
    this.postNow("installFailureTeardown");
  }

  async installFailureTeardown(): Promise<void> {
    await this.tearDownServer();
  }

  portReady(): void {
    this.transition(Running);
  }

  processExited(code: number | null): void {
    this.emitState(undefined, `mmkit server exited with code ${code} during install`);
    this.transition(Idle);
  }
}

export class InstallingPrepare extends Installing {
  onEntry(): void {
    this.postNow("installPrepare");
  }

  async installPrepare(): Promise<void> {
    const snapshot = this.requireSnapshot();
    if (!snapshot) return;
    try {
      const dirs = [
        { label: "data", path: snapshot.paths.dataDir },
        { label: "temporary", path: snapshot.paths.tmpDir },
        { label: "load", path: snapshot.paths.loadDir },
        { label: "workspace", path: snapshot.paths.databaseAllPath },
      ];
      for (let i = 0; i < dirs.length; i += 1) {
        const { label, path: dirPath } = dirs[i]!;
        this.reportInstallStep("prepare", i / dirs.length, `Creating ${label} directory…`);
        await this.ctx.ports.fs.ensureDir(dirPath);
      }
      this.reportInstallStep("prepare", 1, "Data directories ready");
      this.transition(InstallingMaterializeAssets);
    } catch (err) {
      this.postNow("installFailed", `prepare failed: ${String(err)}`);
    }
  }
}

export class InstallingMaterializeAssets extends Installing {
  onEntry(): void {
    this.postNow("installMaterializeAssets");
  }

  async installMaterializeAssets(): Promise<void> {
    const snapshot = this.requireSnapshot();
    if (!snapshot) return;
    try {
      const complete = await this.ctx.ports.assets.isInstallationComplete(snapshot.paths);
      if (!complete) {
        await this.ctx.ports.assets.materialize(snapshot.paths, (message, fraction) => {
          this.reportInstallStep("materialize", fraction, message);
        });
      } else {
        this.reportInstallStep("materialize", 1, "Workspace already installed");
      }
      this.transition(InstallingEnsureDockerImage);
    } catch (err) {
      this.postNow("installFailed", `materialize failed: ${String(err)}`);
    }
  }
}

export class InstallingEnsureDockerImage extends Installing {
  onEntry(): void {
    this.postNow("installEnsureDockerImage");
  }

  async installEnsureDockerImage(): Promise<void> {
    const snapshot = this.requireSnapshot();
    if (!snapshot) return;
    try {
      if (snapshot.server.launchKind !== "docker") {
        this.reportInstallStep("dockerImage", 1, "Using local mmkit server executable");
        this.transition(InstallingLaunchContainer);
        return;
      }
      const image = snapshot.server.dockerImage;
      this.reportInstallStep("dockerImage", 0, `Checking Docker image ${image}…`);
      const exists = await this.ctx.ports.docker.imageExists(image);
      if (!exists) {
        await this.ctx.ports.docker.pullImage(image, (message, fraction) => {
          this.reportInstallStep("dockerImage", fraction, message);
        });
      } else {
        this.reportInstallStep("dockerImage", 1, `Docker image ${image} already present`);
      }
      this.transition(InstallingLaunchContainer);
    } catch (err) {
      this.postNow("installFailed", `docker image failed: ${String(err)}`);
    }
  }
}

export class InstallingLaunchContainer extends Installing {
  onEntry(): void {
    this.postNow("installLaunchContainer");
  }

  async installLaunchContainer(): Promise<void> {
    const snapshot = this.requireSnapshot();
    if (!snapshot) return;
    const spec = buildLaunchSpec(snapshot);
    const launchLabel = spec.kind === "docker" ? "container" : "process";
    this.reportInstallStep("launch", 0, `Starting mmkit server ${launchLabel}…`);
    try {
      if (spec.kind === "docker") {
        const info = await this.ctx.ports.docker.run(spec);
        this.ctx.containerName = snapshot.server.dockerContainerName;
        this.ctx.pid = info.pid;
        this.reportInstallStep("launch", 0.7, `Container ${snapshot.server.dockerContainerName} started`);
      } else {
        const info = await this.ctx.ports.process.spawn(spec);
        this.ctx.pid = info.pid;
        this.ctx.exitUnsubscribe = this.ctx.ports.process.onExit(info.pid, (code) => {
          this.postNow("processExited", code);
        });
        this.reportInstallStep("launch", 0.7, `mmkit server process started (pid ${info.pid})`);
      }
      this.reportInstallStep("launch", 1, "mmkit server launched");
      this.transition(InstallingAwaitPort);
    } catch (err) {
      this.postNow("installFailed", `Launch failed: ${String(err)}`);
    }
  }
}

export class InstallingAwaitPort extends Installing {
  onEntry(): void {
    this.postNow("installAwaitPort");
  }

  async installAwaitPort(): Promise<void> {
    const snapshot = this.requireSnapshot();
    if (!snapshot) return;
    try {
      const maxAttempts = Number(process.env.MMKIT_PORT_PROBE_ATTEMPTS ?? "120");
      const probeIntervalMs = Number(process.env.MMKIT_PORT_PROBE_INTERVAL_MS ?? "500");
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        this.maybeShowSlowStartProgress();
        const fraction = attempt / maxAttempts;
        this.reportInstallStep(
          "awaitPort",
          fraction,
          `Waiting for mmkit server on port ${snapshot.server.port}… (attempt ${attempt + 1}/${maxAttempts})`
        );
        const probe = await this.ctx.ports.network.probe("127.0.0.1", snapshot.server.port, 1000);
        if (probe.reachable) {
          this.reportInstallStep("awaitPort", 1, "mmkit server is accepting connections");
          this.postNow("portReady");
          return;
        }
        await this.delay(probeIntervalMs);
      }
      this.postNow("installFailed", "port not reachable");
    } catch (err) {
      this.postNow("installFailed", `port probe failed: ${String(err)}`);
    }
  }
}

export class Running extends ServerTop {
  onEntry(): void {
    this.clearFastStartWatchdog();
    this.hideProgressIfVisible();
    this.reportInstallProgress("mmkit server is running", 100);
    this.emitState("mmkit server running");
  }

  userStart(_snapshot: ConfigSnapshotPayload, _generation: number): void {}

  processExited(code: number | null): void {
    this.emitState(undefined, `mmkit server exited with code ${code}`);
    this.transition(Idle);
  }
}

export class Stopping extends ServerTop {
  onEntry(): void {
    this.emitState("Stopping mmkit server");
    this.clearFastStartWatchdog();
    this.postNow("beginStop");
  }

  async beginStop(): Promise<void> {
    await this.tearDownServer();
  }
}

export class ShuttingDown extends ServerTop {
  onEntry(): void {
    this.hideProgressIfVisible();
    this.emitState("mmkit server shut down");
  }
}

ihsm.registerStateNames({
  Idle,
  Starting,
  Installing,
  InstallingPrepare,
  InstallingMaterializeAssets,
  InstallingEnsureDockerImage,
  InstallingLaunchContainer,
  InstallingAwaitPort,
  Running,
  Stopping,
  ShuttingDown,
});

export function createMmkitServerActor(
  ctx: MmkitServerActorCtx
): ihsm.Hsm<MmkitServerActorCtx, MmkitServerActorProtocol> {
  return createLspHsm(ServerTop, ctx);
}
