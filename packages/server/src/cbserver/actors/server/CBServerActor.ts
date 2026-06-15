import * as ihsm from "ihsm";
import { CBServerContext } from "./CBServerContext";
import { CBServerTop } from "./CBServerConfig";
import type { CBServerActorRef, CBServerLogChildren, CBServerMachinePortInput, CBServerMachineConfig, CBServerPortHandle } from "./CBServerConfig";
import * as inv from "./CBServerInvariants";
import type { ICBConnection, ICBConnectionOptions } from "../../shared/CBServerDefs";
import { CBConnectionHandle } from "../connection/CBConnectionHandle";
import { CBConnectionContext, waitForConnectionBootstrap } from "../connection/CBServerConnectionContext";
import type { CBConnectionActor } from "../connection/CBServerConnectionConfig";
import { CBConnectionOrchestratorPort } from "../connection/CBConnectionOrchestratorPort";
import { resolveTcpPortProbeSchedule } from "./tcpPortProbe";
import type { TcpPortProbeSchedule } from "./tcpPortProbe";
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
 *       - TcpConnecting
 *     - ProcessActive
 *       * Running
 *       - Stopping     (closing TCP connections; SIGTERM not yet sent)
 *       - Terminating  (SIGTERM sent; kill grace → SIGKILL; awaiting process exit)
 * ```
 *
 * Command transport is TCP-only via {@link CBConnectionTop} children.
 * Process stdout/stderr are observed by separate log reader child actors.
 */

export class Initialized extends CBServerTop {
  /**
   * Supervisor past `initialize()` — {@link assertInitialized} must hold.
   * @see {@link assertInitialized} for why `serverMailbox` is required and how it is verified.
   */
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

  /** Late log line after detach — swallow (ProcessObserving overrides with emit). */
  onStdoutLine(_line: string): void {
    this._checkInvariant();
  }

  /** Late log line after detach — swallow (ProcessObserving overrides with emit). */
  onStderrLine(_line: string): void {
    this._checkInvariant();
  }

  /** Late connection child close after supervisor detached — swallow. */
  onConnectionChildClosed(): void {
    this._checkInvariant();
  }

  /** Late log-reader interrupt ack — swallow (ProcessDetaching / Stopping override). */
  onStdoutLogReaderInterrupted(): void {
    this._checkInvariant();
  }

  /** Late log-reader interrupt ack — swallow (ProcessDetaching / Stopping override). */
  onStderrLogReaderInterrupted(): void {
    this._checkInvariant();
  }
}

@ihsm.InitialState
export class ProcessDetached extends Initialized {
  /**
   * No live cbserver process — {@link assertProcessDetached}.
   * @see {@link assertProcessDetached}
   */
  protected override _checkInvariant(): void {
    inv.assertProcessDetached(this.ctx);
  }
}

export class ProcessDetaching extends Initialized {
  /**
   * Log readers tearing down after process exit — {@link assertProcessDetaching}.
   * @see {@link assertProcessDetaching} and {@link assertProcessDetachingAfterInterrupt}
   */
  protected override _checkInvariant(): void {
    inv.assertProcessDetaching(this.ctx);
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

  onStderrLogReaderInterrupted(): void {
    this._checkInvariant();
    this.ctx.noteLogReaderInterrupted();
    this.notifyNow.doFinalizeDetach();
  }

  onStdoutLogReaderInterrupted(): void {
    this._checkInvariant();
    this.ctx.noteLogReaderInterrupted();
    this.notifyNow.doFinalizeDetach();
  }

  /** Kill-grace timer may fire after process exit — swallow. */
  onKillGraceElapsed(): void {
    this._checkInvariant();
  }

  doFinalizeDetach(): void {
    this._checkInvariant();
    inv.assertProcessDetachingAfterInterrupt(this.ctx);
    if (this.ctx.allInterrupted()) {
      this.hsm.transition(this.ctx.shutdownRequested ? ShuttingDown : Stopped);
    }
  }
}

@ihsm.InitialState
export class Uninitialized extends CBServerTop {
  /**
   * Pre-`initialize()` — mailbox must not exist yet.
   * @see {@link assertUninitializedInstance}
   */
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
  /**
   * Idle detached — ready to `start()` again.
   * @see {@link assertStopped}
   */
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
  /**
   * Process detached after explicit shutdown request.
   * @see {@link assertShuttingDown}
   */
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
  /**
   * Process handle and subscription must stay paired.
   * @see {@link assertProcessObserving}
   */
  protected override _checkInvariant(): void {
    inv.assertProcessObserving(this.ctx);
  }

  stop(): void {
    this._checkInvariant();
    this.hsm.transition(Stopping);
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

  async doSpawnLogReaders(): Promise<void> {
    this._checkInvariant();
    if (this.ctx.children !== undefined) {
      throw new Error("invariant violation: log readers already armed");
    }
    const server: CBServerActorRef = this.ctx.serverMailbox!;
    cbTrace("supervisor:spawn-log-readers");
    this.ctx.children = await this.hsm.port.armLogReaders(server);
  }

  doBeginDetach(): void {
    // Callers may have already disposed the process subscription; do not assert spawn armed here.
    // The terminal leaf (ShuttingDown vs Stopped) is decided from shutdownRequested in doFinalizeDetach.
    this.ctx.beginDetachChildren();
    this.hsm.transition(ProcessDetaching);
  }

  doCompleteStop(code: number | null, signal: NodeJS.Signals | null, errorMessage?: string): void {
    this._checkInvariant();
    if (this.ctx.killGraceTimer !== undefined) {
      this.hsm.port.clearTimeout(this.ctx.killGraceTimer);
      this.ctx.killGraceTimer = undefined;
    }
    if (errorMessage !== undefined) {
      this.ctx.recordLastExit(code, signal, errorMessage);
    } else {
      const inferred: string | undefined = code !== null && code !== 0
        ? `cbserver exited (code=${code}, signal=${signal})`
        : undefined;
      this.ctx.recordLastExit(code, signal, inferred);
    }
    this.ctx.clearConnections();
    this.ctx.disposeProcess();
    this.doBeginDetach();
  }
}

/**
 * Forwards raw process stdio to log-reader children.
 * Only states whose invariants include {@link inv.assertLogReadersArmed} mix this in.
 */
export class ProcessStdioForwarding extends ProcessObserving {
  onStdoutData(chunk: string): void {
    this._checkInvariant();
    this.ctx.children!.stdoutLogReader.notify.onData(chunk);
  }

  onStderrData(chunk: string): void {
    this._checkInvariant();
    this.ctx.children!.stderrLogReader.notify.onData(chunk);
  }

  onStdoutEnd(): void {
    this._checkInvariant();
    this.ctx.children!.stdoutLogReader.notify.onEnd();
  }

  onStdoutClose(): void {
    this._checkInvariant();
    this.ctx.children!.stdoutLogReader.notify.onStreamClose();
  }

  onStderrEnd(): void {
    this._checkInvariant();
    this.ctx.children!.stderrLogReader.notify.onEnd();
  }

  onStderrClose(): void {
    this._checkInvariant();
    this.ctx.children!.stderrLogReader.notify.onStreamClose();
  }

  onStdoutStdioError(errorMessage: string): void {
    this._checkInvariant();
    this.ctx.children!.stdoutLogReader.notify.onStreamError(errorMessage);
  }

  onStderrStdioError(errorMessage: string): void {
    this._checkInvariant();
    this.ctx.children!.stderrLogReader.notify.onStreamError(errorMessage);
  }
}

@ihsm.InitialState
export class Starting extends ProcessObserving {
  /**
   * Boot in progress; kill not yet signaled.
   * @see {@link assertStarting}
   */
  protected override _checkInvariant(): void {
    inv.assertStarting(this.ctx);
  }

  protected clearTcpPortProbeRetryTimer(): void {
    if (this.ctx.tcpPortProbeRetryTimer !== undefined) {
      this.hsm.port.clearTimeout(this.ctx.tcpPortProbeRetryTimer);
      this.ctx.tcpPortProbeRetryTimer = undefined;
    }
  }

  protected abortStartupFailure( code: number | null, signal: NodeJS.Signals | null, errorMessage: string ): void {
    this._checkInvariant();
    this.clearTcpPortProbeRetryTimer();
    this.ctx.recordLastExit(code, signal, errorMessage);
    const pid: number = this.ctx.pid!;
    this.ctx.disposeProcess();
    void this.hsm.port.kill(pid, "SIGTERM").catch(() => undefined);
    this.doBeginDetach();
  }
}

@ihsm.InitialState
export class SpawnPending extends Starting {
  /**
   * OS spawn in flight — no pid or log readers yet.
   * @see {@link assertSpawnPending}
   */
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
      const { value, subscription }: ihsm.ResultWithSubscription<number> =
        await this.hsm.port.spawn(this.ctx.config);
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
    this.doBeginDetach();
  }
}

export class SpawnArmed extends Starting {
  /**
   * Process spawned; log-reader arm runs next, then optional TCP port probe.
   * @see {@link assertSpawnArmed}
   */
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
      if (this.ctx.config.network.port > 0) {
        this.hsm.transition(TcpConnecting);
        return;
      }
      this.hsm.transition(Running);
    } catch (err) {
      const message: string = err instanceof Error ? err.message : String(err);
      this.abortStartupFailure(null, null, `cbserver startup failed: ${message}`);
    }
  }

  /** Stdio may arrive before {@link doBeginStartup} finishes arming log readers — drop. */
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

  onProcessExit(code: number | null, signal: NodeJS.Signals | null): void {
    this._checkInvariant();
    this.abortStartupFailure(code, signal, `cbserver exited during start (code=${code}, signal=${signal})`,);
  }

  onProcessError(errorMessage: string): void {
    this._checkInvariant();
    this.abortStartupFailure(null, null, errorMessage);
  }

  onDisconnect(): void {
    this._checkInvariant();
    this.abortStartupFailure(null, null, "cbserver disconnected during start");
  }
}

export class TcpConnecting extends Starting {
  /**
   * TCP listen probe in progress — one connect attempt per {@link doTcpPortProbeStep}.
   * @see {@link assertTcpConnecting}
   */
  protected override _checkInvariant(): void {
    inv.assertTcpConnecting(this.ctx);
  }

  onStdoutData(chunk: string): void {
    this._checkInvariant();
    this.ctx.children!.stdoutLogReader.notify.onData(chunk);
  }

  onStderrData(chunk: string): void {
    this._checkInvariant();
    this.ctx.children!.stderrLogReader.notify.onData(chunk);
  }

  onStdoutEnd(): void {
    this._checkInvariant();
    this.ctx.children!.stdoutLogReader.notify.onEnd();
  }

  onStdoutClose(): void {
    this._checkInvariant();
    this.ctx.children!.stdoutLogReader.notify.onStreamClose();
  }

  onStderrEnd(): void {
    this._checkInvariant();
    this.ctx.children!.stderrLogReader.notify.onEnd();
  }

  onStderrClose(): void {
    this._checkInvariant();
    this.ctx.children!.stderrLogReader.notify.onStreamClose();
  }

  onStdoutStdioError(errorMessage: string): void {
    this._checkInvariant();
    this.ctx.children!.stdoutLogReader.notify.onStreamError(errorMessage);
  }

  onStderrStdioError(errorMessage: string): void {
    this._checkInvariant();
    this.ctx.children!.stderrLogReader.notify.onStreamError(errorMessage);
  }

  onEntry(): void {
    this.ctx.tcpPortProbeAttempt = 0;
    this.notifyNow.doTcpPortProbeStep();
    inv.assertTcpConnecting(this.ctx);
  }

  onExit(): void {
    this.clearTcpPortProbeRetryTimer();
  }

  async doTcpPortProbeStep(): Promise<void> {
    this._checkInvariant();
    const tcpPort: number = this.ctx.config.network.port;
    const schedule: TcpPortProbeSchedule = resolveTcpPortProbeSchedule(this.ctx.config.network);
    this.ctx.tcpPortProbeAttempt += 1;
    const attempt: number = this.ctx.tcpPortProbeAttempt;
    try {
      const reachable: boolean = await this.hsm.port.probeTcpConnect( { host: "127.0.0.1", port: tcpPort, connectTimeoutMs: schedule.connectTimeoutMs, } );
      if (reachable) {
        this.hsm.transition(Running);
        return;
      }
      if (attempt >= schedule.maxAttempts) {
        this.abortStartupFailure(null, null, `TCP port not reachable on 127.0.0.1:${tcpPort}`,);
        return;
      }
      this.clearTcpPortProbeRetryTimer();
      this.ctx.tcpPortProbeRetryTimer = this.hsm.port.setTimeout(() => this.notify.onTcpPortProbeRetry(), schedule.intervalMs,);
    } catch (err) {
      const message: string = err instanceof Error ? err.message : String(err);
      this.abortStartupFailure(null, null, `cbserver startup failed: ${message}`);
    }
  }

  onTcpPortProbeRetry(): void {
    this._checkInvariant();
    this.ctx.tcpPortProbeRetryTimer = undefined;
    this.notifyNow.doTcpPortProbeStep();
  }

  onProcessExit(code: number | null, signal: NodeJS.Signals | null): void {
    this._checkInvariant();
    this.abortStartupFailure(code, signal, `cbserver exited during start (code=${code}, signal=${signal})`,);
  }

  onProcessError(errorMessage: string): void {
    this._checkInvariant();
    this.abortStartupFailure(null, null, errorMessage);
  }

  onDisconnect(): void {
    this._checkInvariant();
    this.abortStartupFailure(null, null, "cbserver disconnected during start");
  }
}

export class ProcessActive extends ProcessStdioForwarding {
  /**
   * Live process with spawn armed (Running or Stopping).
   * @see {@link assertProcessActive}
   */
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
}

@ihsm.InitialState
export class Running extends ProcessActive {
  /**
   * Accepting TCP connections; kill not signaled.
   * @see {@link assertRunning}
   */
  protected override _checkInvariant(): void {
    inv.assertRunning(this.ctx);
  }

  onEntry(): void {
    this.ctx.statusEvents.emit("status", this.hsm.currentStateName);
    inv.assertRunning(this.ctx);
  }

  async createConnection(options?: ICBConnectionOptions): Promise<ICBConnection> {
    this._checkInvariant();
    const tcpPort: number = this.ctx.config.network.port;
    if (tcpPort <= 0) {
      throw new Error("createConnection requires network.port > 0 (TCP mode)");
    }
    const connectionId: string = this.ctx.allocConnectionId();
    const serverMailbox: CBServerActorRef =
      (this.hsm.port as unknown as { actor: CBServerActorRef }).actor;
    const onClose: () => void = () => {
      this.ctx.unregisterConnection(connectionId);
      cbTrace("supervisor:connection-closed", { connectionId });
      serverMailbox.notify.onConnectionChildClosed();
    };
    const context: CBConnectionContext = new CBConnectionContext( connectionId, onClose, { host: "127.0.0.1", port: tcpPort, toolName: options?.label ?? this.ctx.config.mmkit.clientToolName, userName: options?.userName ?? this.ctx.config.mmkit.clientUserName, connectTimeoutMs: options?.connectTimeoutMs, socketTimeoutMs: options?.socketTimeoutMs, } );
    const bootstrap: Promise<void> = waitForConnectionBootstrap(context);
    cbTrace("supervisor:spawn-connection", { connectionId });
    const orchestratorPort: CBConnectionOrchestratorPort = new CBConnectionOrchestratorPort();
    const child: CBConnectionActor = await this.hsm.port.spawnConnection(this.ctx.serverMailbox!, context, orchestratorPort);
    await bootstrap;
    this.ctx.registerConnection(connectionId, child);
    return new CBConnectionHandle(child, context);
  }
}

export class Stopping extends ProcessActive {
  /**
   * Graceful stop, phase 1: close live TCP connections before signalling the process.
   * SIGTERM is not sent here — that is the {@link Terminating} phase — so there is no
   * "kill signalled" flag; the phase is the state.
   * @see {@link assertStopping}
   */
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
      this.hsm.transition(Terminating);
      return;
    }
    const child: CBConnectionActor = this.ctx.connections.values().next().value as CBConnectionActor;
    child.notify.close();
  }
}

export class Terminating extends ProcessActive {
  /**
   * Graceful stop, phase 2: SIGTERM sent on entry, kill grace armed; SIGKILL on timeout.
   * Process exit is handled by {@link ProcessActive.onProcessExit} → `doCompleteStop`.
   * @see {@link assertTerminating}
   */
  protected override _checkInvariant(): void {
    inv.assertTerminating(this.ctx);
  }

  onEntry(): void {
    this.notifyNow.doSendSigterm();
    inv.assertTerminating(this.ctx);
  }

  onExit(): void {
    if (this.ctx.killGraceTimer !== undefined) {
      this.hsm.port.clearTimeout(this.ctx.killGraceTimer);
      this.ctx.killGraceTimer = undefined;
    }
  }

  doSendSigterm(): void {
    this._checkInvariant();
    void this.hsm.port.kill(this.ctx.pid!, "SIGTERM").catch(() => undefined);
    this.ctx.killGraceTimer = this.hsm.port.setTimeout( () => { this.notify.onKillGraceElapsed(); }, this.ctx.config.mmkit.killGraceMs );
  }

  onKillGraceElapsed(): void {
    this._checkInvariant();
    void this.hsm.port.kill(this.ctx.pid!, "SIGKILL").catch(() => undefined);
  }
}

export { CBServerTop };

ihsm.registerStateNames({ CBServerTop });
ihsm.registerStateNames(self);
