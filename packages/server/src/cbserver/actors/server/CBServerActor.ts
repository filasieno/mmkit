import * as ihsm from "ihsm";
import { CBServerContext } from "./CBServerContext";
import {
  CBServerTop,
  type CBServerActorRef,
  type CBServerMachinePortInput,
  type CBServerMachineConfig,
  type CBServerPortHandle,
} from "./CBServerConfig";
import * as inv from "./CBServerInvariants";
import { resolvePortProbeSettings } from "./settings/CBServerSettings";
import type { ICBConnection, ICBConnectionOptions } from "../../shared/CBServerDefs";
import { CBConnectionHandle } from "../connection/CBConnectionHandle";
import { CBConnectionContext, waitForConnectionBootstrap } from "../connection/CBServerConnectionContext";
import type { CBConnectionActor } from "../connection/CBServerConnectionConfig";
import { CBConnectionOrchestratorPort } from "../connection/CBConnectionOrchestratorPort";
import { cbTrace } from "../../shared/cbTrace";
import * as self from "./CBServerActor";

/**
 * CBServer supervisor — state hierarchy (* = {@link ihsm.InitialState}, - = other states)
 *
 * ```text
 * CBServerTop
 * * Uninitialized
 * - Initialized
 *   * ProcessDetached
 *     * Stopped
 *     - ShuttingDown
 *   - ProcessDetaching
 *   - ProcessObserving
 *     * Starting
 *       * SpawnPending
 *       - SpawnArmed
 *     - ProcessActive
 *       * Running
 *       - Stopping
 * ```
 *
 * Command transport is TCP-only via {@link CBConnectionTop} children.
 * Process stdout/stderr are observed by separate log reader child actors.
 */

export class Initialized extends CBServerTop {
  protected override _checkInvariant(): void {
    inv.assertInitialized(this.ctx);
  }

  async subscribeStatus(listener: (state: string) => void): Promise<ihsm.Disposable> {
    this._checkInvariant();
    this.ctx.statusEvents.on("status", listener);
    listener(this.hsm.currentStateName);
    return {
      dispose: () => {
        this.ctx.statusEvents.off("status", listener);
      },
    };
  }

  async subscribeProcessIo(listener: (stream: "stdout" | "stderr", line: string) => void): Promise<ihsm.Disposable> {
    this._checkInvariant();
    this.ctx.processIoEvents.on("line", listener);
    return {
      dispose: () => {
        this.ctx.processIoEvents.off("line", listener);
      },
    };
  }

  async getCurrentStateName(): Promise<string> {
    this._checkInvariant();
    return this.hsm.currentStateName;
  }

  async createConnection(_options?: ICBConnectionOptions): Promise<ICBConnection> {
    this._checkInvariant();
    throw new Error(`illegal state: createConnection is not allowed in ${this.hsm.currentStateName}`);
  }

  requestShutdown(): void {
    this._checkInvariant();
    this.ctx.shutdownRequested = true;
  }

  start(): void {
    this._checkInvariant();
  }

  stop(): void {
    this._checkInvariant();
  }

  onStdoutData(_chunk: string): void {
    this._checkInvariant();
  }

  onStderrData(_chunk: string): void {
    this._checkInvariant();
  }

  onStdoutEnd(): void {
    this._checkInvariant();
  }

  onStdoutClose(): void {
    this._checkInvariant();
  }

  onStderrEnd(): void {
    this._checkInvariant();
  }

  onStderrClose(): void {
    this._checkInvariant();
  }

  onStdoutStdioError(_errorMessage: string): void {
    this._checkInvariant();
  }

  onStderrStdioError(_errorMessage: string): void {
    this._checkInvariant();
  }
}

@ihsm.InitialState
export class ProcessDetached extends Initialized {
  protected override _checkInvariant(): void {
    inv.assertProcessDetached(this.ctx);
  }

  onSpawn(): void {
    this._checkInvariant();
  }

  onProcessExit(_code: number | null, _signal: NodeJS.Signals | null): void {
    this._checkInvariant();
  }

  onProcessClose(_code: number | null, _signal: NodeJS.Signals | null): void {
    this._checkInvariant();
  }

  onProcessError(_errorMessage: string): void {
    this._checkInvariant();
  }

  onDisconnect(): void {
    this._checkInvariant();
  }

  onFailToStart(_errorMessage: string): void {
    this._checkInvariant();
  }

  onKillGraceElapsed(): void {
    this._checkInvariant();
  }
}

export class ProcessDetaching extends Initialized {
  protected override _checkInvariant(): void {
    inv.assertProcessDetaching(this.ctx);
  }

  onSpawn(): void {
    this._checkInvariant();
  }

  onProcessExit(_code: number | null, _signal: NodeJS.Signals | null): void {
    this._checkInvariant();
  }

  onProcessClose(_code: number | null, _signal: NodeJS.Signals | null): void {
    this._checkInvariant();
  }

  onProcessError(_errorMessage: string): void {
    this._checkInvariant();
  }

  onDisconnect(): void {
    this._checkInvariant();
  }

  onFailToStart(_errorMessage: string): void {
    this._checkInvariant();
  }

  onKillGraceElapsed(): void {
    this._checkInvariant();
  }

  onEntry(): void {
    this.notify.doDispatchInterrupt();
    inv.assertProcessDetaching(this.ctx);
  }

  doDispatchInterrupt(): void {
    this._checkInvariant();
    this.ctx.dispatchInterruptToChildren();
    inv.assertProcessDetachingAfterInterrupt(this.ctx);
    this.notifyNow.doFinalizeDetach();
  }

  onStdoutData(_chunk: string): void {
    this._checkInvariant();
  }

  onStderrData(_chunk: string): void {
    this._checkInvariant();
  }

  onStdoutEnd(): void {
    this._checkInvariant();
  }

  onStderrEnd(): void {
    this._checkInvariant();
  }

  onStdoutStdioError(_errorMessage: string): void {
    this._checkInvariant();
  }

  onStderrStdioError(_errorMessage: string): void {
    this._checkInvariant();
  }

  onStderrLogReaderInterrupted(): void {
    this._checkInvariant();
    this.ctx.noteStderrLogReaderInterrupted();
    this.notifyNow.doFinalizeDetach();
  }

  onStdoutLogReaderInterrupted(): void {
    this._checkInvariant();
    this.ctx.noteStdoutLogReaderInterrupted();
    this.notifyNow.doFinalizeDetach();
  }

  doFinalizeDetach(): void {
    inv.assertProcessDetachingAfterInterrupt(this.ctx);
    if (this.ctx.allInterrupted()) {
      this.hsm.transition(this.ctx.detachTarget === "shuttingDown" ? ShuttingDown : Stopped);
    }
  }
}

@ihsm.InitialState
export class Uninitialized extends CBServerTop {
  protected override _checkInvariant(): void {
    inv.assertUninitializedInstance(this.ctx);
  }

  async initialize(): Promise<void> {
    this._checkInvariant();
    this.ctx.serverMailbox = (this.hsm.port as unknown as CBServerPortHandle).actor;
    this.hsm.transition(Initialized);
  }
}

@ihsm.InitialState
export class Stopped extends ProcessDetached {
  protected override _checkInvariant(): void {
    inv.assertStopped(this.ctx);
  }

  onEntry(): void {
    this.ctx.resetIdle();
    this.ctx.statusEvents.emit("status", this.hsm.currentStateName);
    inv.assertStopped(this.ctx);
  }

  start(): void {
    this._checkInvariant();
    this.hsm.transition(Starting);
  }
}

export class ShuttingDown extends ProcessDetached {
  protected override _checkInvariant(): void {
    inv.assertShuttingDown(this.ctx);
  }

  onEntry(): void {
    this.ctx.resetShutdown();
    this.ctx.statusEvents.emit("status", this.hsm.currentStateName);
    inv.assertShuttingDown(this.ctx);
  }
}

export class ProcessObserving extends Initialized {
  protected override _checkInvariant(): void {
    inv.assertProcessObserving(this.ctx);
  }

  stop(): void {
    this._checkInvariant();
    this.hsm.transition(Stopping);
  }

  onSpawn(): void {
    this._checkInvariant();
  }

  onStderrLine(line: string): void {
    this._checkInvariant();
    this.ctx.processIoEvents.emit("line", "stderr", line);
  }

  onStdoutLine(line: string): void {
    this._checkInvariant();
    this.ctx.processIoEvents.emit("line", "stdout", line);
  }

  onProcessClose(code: number | null, signal: NodeJS.Signals | null): void {
    this._checkInvariant();
    this.ctx.recordLastExit(code, signal);
  }

  onFailToStart(_errorMessage: string): void {
    this._checkInvariant();
  }

  onKillGraceElapsed(): void {
    this._checkInvariant();
  }

  onStdoutData(chunk: string): void {
    this._checkInvariant();
    const children = this.ctx.children;
    if (children === undefined) {
      return;
    }
    children.stdoutLogReader.notify.onData(chunk);
  }

  onStderrData(chunk: string): void {
    this._checkInvariant();
    const children = this.ctx.children;
    if (children === undefined) {
      return;
    }
    children.stderrLogReader.notify.onData(chunk);
  }

  onStdoutEnd(): void {
    this._checkInvariant();
    this.ctx.children?.stdoutLogReader.notify.onEnd();
  }

  onStdoutClose(): void {
    this._checkInvariant();
    this.ctx.children?.stdoutLogReader.notify.onStreamClose();
  }

  onStderrEnd(): void {
    this._checkInvariant();
    this.ctx.children?.stderrLogReader.notify.onEnd();
  }

  onStderrClose(): void {
    this._checkInvariant();
    this.ctx.children?.stderrLogReader.notify.onStreamClose();
  }

  onStdoutStdioError(errorMessage: string): void {
    this._checkInvariant();
    this.ctx.children?.stdoutLogReader.notify.onStreamError(errorMessage);
  }

  onStderrStdioError(errorMessage: string): void {
    this._checkInvariant();
    this.ctx.children?.stderrLogReader.notify.onStreamError(errorMessage);
  }

  async doSpawnLogReaders(): Promise<void> {
    this._checkInvariant();
    if (this.ctx.children !== undefined || this.ctx.pid === undefined) {
      return;
    }
    const server = this.ctx.serverMailbox!;
    cbTrace("supervisor:spawn-log-readers");
    this.ctx.children = await this.hsm.port.armLogReaders(server);
  }

  doBeginDetach(target: "stopped" | "shuttingDown"): void {
    this.ctx.beginDetachChildren(target);
    this.hsm.transition(ProcessDetaching);
  }

  doCompleteStop(code: number | null, signal: NodeJS.Signals | null, errorMessage?: string): void {
    if (this.ctx.killGraceTimer !== undefined) {
      this.hsm.port.clearTimeout(this.ctx.killGraceTimer);
      this.ctx.killGraceTimer = undefined;
    }
    if (errorMessage !== undefined) {
      this.ctx.recordLastExit(code, signal, errorMessage);
    } else {
      const inferred = code !== null && code !== 0
        ? `cbserver exited (code=${code}, signal=${signal})`
        : undefined;
      this.ctx.recordLastExit(code, signal, inferred);
    }
    this.ctx.clearConnections();
    this.ctx.disposeProcess();
    this.doBeginDetach(this.ctx.shutdownRequested ? "shuttingDown" : "stopped");
  }
}

@ihsm.InitialState
export class Starting extends ProcessObserving {
  protected override _checkInvariant(): void {
    inv.assertStarting(this.ctx);
  }
}

@ihsm.InitialState
export class SpawnPending extends Starting {
  protected override _checkInvariant(): void {
    inv.assertSpawnPending(this.ctx);
  }

  onEntry(): void {
    this.ctx.resetForStart();
    this.ctx.statusEvents.emit("status", this.hsm.currentStateName);
    this.notifyNow.doStart();
    inv.assertSpawnPending(this.ctx);
  }

  async doStart(): Promise<void> {
    this._checkInvariant();
    try {
      const { value, subscription } = await this.hsm.port.spawn(this.ctx.config);
      if (this.hsm.currentState !== SpawnPending) {
        subscription.dispose();
        void this.hsm.port.kill(value, "SIGTERM").catch(() => undefined);
        return;
      }
      this.ctx.pid = value;
      this.ctx.processSubscription = subscription;
      this.hsm.transition(SpawnArmed);
    } catch (err) {
      this.notifyNow.onFailToStart(`cbserver start failed: ${String(err)}`);
    }
  }

  onFailToStart(errorMessage: string): void {
    this._checkInvariant();
    this.abortSpawnPendingFailure(errorMessage);
  }

  onDisconnect(): void {
    this._checkInvariant();
    this.abortSpawnPendingFailure("cbserver disconnected during start");
  }

  protected abortSpawnPendingFailure(errorMessage: string): void {
    this._checkInvariant();
    this.ctx.recordLastExit(null, null, errorMessage);
    this.ctx.disposeProcess();
    this.doBeginDetach("stopped");
  }
}

export class SpawnArmed extends Starting {
  protected override _checkInvariant(): void {
    inv.assertSpawnArmed(this.ctx);
  }

  onEntry(): void {
    this.notifyNow.doBeginStartup();
    inv.assertSpawnArmed(this.ctx);
  }

  async doBeginStartup(): Promise<void> {
    this._checkInvariant();
    try {
      await this.doSpawnLogReaders();
      const tcpPort = this.ctx.config.network.port;
      if (tcpPort > 0) {
        const probe = resolvePortProbeSettings(this.ctx.config.network);
        await this.hsm.port.awaitTcpListen({
          host: "127.0.0.1",
          port: tcpPort,
          maxAttempts: probe.portProbeMaxAttempts,
          intervalMs: probe.portProbeIntervalMs,
          connectTimeoutMs: probe.portProbeConnectTimeoutMs,
        });
      }
      this.notifyNow.doPromoteRunning();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.abortSpawnArmedFailure(null, null, `cbserver startup failed: ${message}`);
    }
  }

  doPromoteRunning(): void {
    this._checkInvariant();
    this.hsm.transition(Running);
  }

  onProcessExit(code: number | null, signal: NodeJS.Signals | null): void {
    this._checkInvariant();
    this.abortSpawnArmedFailure(
      code,
      signal,
      `cbserver exited during start (code=${code}, signal=${signal})`,
    );
  }

  onProcessError(errorMessage: string): void {
    this._checkInvariant();
    this.abortSpawnArmedFailure(null, null, errorMessage);
  }

  onDisconnect(): void {
    this._checkInvariant();
    this.abortSpawnArmedFailure(null, null, "cbserver disconnected during start");
  }

  protected abortSpawnArmedFailure(
    code: number | null,
    signal: NodeJS.Signals | null,
    errorMessage: string,
  ): void {
    this._checkInvariant();
    this.ctx.recordLastExit(code, signal, errorMessage);
    const pid = this.ctx.pid!;
    this.ctx.disposeProcess();
    void this.hsm.port.kill(pid, "SIGTERM").catch(() => undefined);
    this.doBeginDetach("stopped");
  }
}

export class ProcessActive extends ProcessObserving {
  protected override _checkInvariant(): void {
    inv.assertProcessActive(this.ctx);
  }

  onProcessExit(code: number | null, signal: NodeJS.Signals | null): void {
    this._checkInvariant();
    this.ctx.recordLastExit(code, signal);
    this.notifyNow.doCompleteStop(code, signal);
  }

  onProcessError(errorMessage: string): void {
    this._checkInvariant();
    this.notifyNow.doCompleteStop(null, null, errorMessage);
  }

  onDisconnect(): void {
    this._checkInvariant();
    this.notifyNow.doCompleteStop(null, null);
  }

  onConnectionChildClosed(): void {
    this._checkInvariant();
  }
}

@ihsm.InitialState
export class Running extends ProcessActive {
  protected override _checkInvariant(): void {
    inv.assertRunning(this.ctx);
  }

  onEntry(): void {
    this.ctx.statusEvents.emit("status", this.hsm.currentStateName);
    if (this.ctx.children === undefined) {
      this.notifyNow.doSpawnLogReaders();
    }
    inv.assertRunning(this.ctx);
  }

  async createConnection(options?: ICBConnectionOptions): Promise<ICBConnection> {
    this._checkInvariant();
    const tcpPort = this.ctx.config.network.port;
    if (tcpPort <= 0) {
      throw new Error("createConnection requires network.port > 0 (TCP mode)");
    }
    const connectionId = this.ctx.allocConnectionId();
    const serverMailbox = (this.hsm.port as unknown as { actor: CBServerActorRef }).actor;
    const onClose = () => {
      this.ctx.unregisterConnection(connectionId);
      cbTrace("supervisor:connection-closed", { connectionId });
      serverMailbox.notify.onConnectionChildClosed();
    };
    const context = new CBConnectionContext(connectionId, onClose, {
      host: "127.0.0.1",
      port: tcpPort,
      toolName: options?.label ?? this.ctx.config.mmkit.clientToolName,
      userName: options?.userName ?? this.ctx.config.mmkit.clientUserName,
      connectTimeoutMs: options?.connectTimeoutMs,
      socketTimeoutMs: options?.socketTimeoutMs,
    });
    const bootstrap = waitForConnectionBootstrap(context);
    cbTrace("supervisor:spawn-connection", { connectionId });
    const orchestratorPort = new CBConnectionOrchestratorPort();
    const child = await this.hsm.port.spawnConnection(this.ctx.serverMailbox!, context, orchestratorPort);
    await bootstrap;
    this.ctx.registerConnection(connectionId, child);
    return new CBConnectionHandle(child, context);
  }
}

export class Stopping extends ProcessActive {
  protected override _checkInvariant(): void {
    inv.assertStopping(this.ctx);
  }

  onEntry(): void {
    this.ctx.statusEvents.emit("status", this.hsm.currentStateName);
    this.notifyNow.doCloseAllConnections();
    inv.assertStopping(this.ctx);
  }

  onConnectionChildClosed(): void {
    this._checkInvariant();
    this.notifyNow.doCloseAllConnections();
  }

  doCloseAllConnections(): void {
    this._checkInvariant();
    if (this.ctx.connections.size === 0) {
      this.notifyNow.doStop();
      return;
    }
    const child = this.ctx.connections.values().next().value as CBConnectionActor;
    child.notify.close();
  }

  onStderrLogReaderInterrupted(): void {
    this._checkInvariant();
    this.ctx.noteStderrLogReaderInterrupted();
  }

  onStdoutLogReaderInterrupted(): void {
    this._checkInvariant();
    this.ctx.noteStdoutLogReaderInterrupted();
  }

  onExit(): void {
    if (this.ctx.killGraceTimer !== undefined) {
      this.hsm.port.clearTimeout(this.ctx.killGraceTimer);
      this.ctx.killGraceTimer = undefined;
    }
  }

  doStop(): void {
    this._checkInvariant();
    if (this.ctx.pid === undefined) {
      this.notifyNow.doCompleteStop(null, null);
      return;
    }
    if (!this.ctx.killSignaled) {
      this.notifyNow.doSendSigterm();
    }
  }

  doSendSigterm(): void {
    this._checkInvariant();
    const pid = this.ctx.pid;
    if (pid === undefined) {
      this.notifyNow.doCompleteStop(null, null);
      return;
    }
    this.ctx.killSignaled = true;
    void this.hsm.port.kill(pid, "SIGTERM").catch(() => undefined);
    this.notifyNow.doArmKillGrace();
  }

  doArmKillGrace(): void {
    this._checkInvariant();
    if (this.ctx.killGraceTimer !== undefined) {
      this.hsm.port.clearTimeout(this.ctx.killGraceTimer);
    }
    this.ctx.killGraceTimer = this.hsm.port.setTimeout(() => {
      this.notify.onKillGraceElapsed();
    }, this.ctx.config.mmkit.killGraceMs);
  }

  onKillGraceElapsed(): void {
    this._checkInvariant();
    const pid = this.ctx.pid;
    if (pid === undefined) {
      return;
    }
    void this.hsm.port.kill(pid, "SIGKILL").catch(() => undefined);
  }
}

export function createCBServerActor(ctx: CBServerContext,
  port: CBServerMachinePortInput,
  options?: ihsm.ActorOptions<CBServerMachineConfig>,
): ihsm.ExternalActor<CBServerMachineConfig> {
  return ihsm.makeActor(CBServerTop, ctx, port, options);
}

export { CBServerTop };

ihsm.registerStateNames({ CBServerTop });
ihsm.registerStateNames(self);
