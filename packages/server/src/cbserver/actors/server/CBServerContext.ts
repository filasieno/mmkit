import { EventEmitter } from "node:events";
import type * as ihsm from "ihsm";
import type { CBServerActorRef, CBServerLastExit, CBServerLogChildren, ICBServerContext, } from "./CBServerConfig";
import type { CBServerConfig } from "./settings/CBServerSettings";
import type { CBConnectionActor } from "../connection/CBServerConnectionConfig";

/**
 * Mutable domain state for the CBServer supervisor HSM.
 *
 * Field groups and why they exist:
 *
 * **Immutable inputs** — constructor/config.
 * - `config` — launch paths, network, mmkit tuning for spawn and kill grace.
 *
 * **Outbound observability** — client subscriptions.
 * - `statusEvents` — state name changes (`subscribeStatus`).
 * - `processIoEvents` — decoded stderr/stdout log lines (`subscribeProcessIo`).
 *
 * **Subprocess handle** — paired while a process is armed.
 * - `pid`, `processSubscription` — set by `doStart`; cleared by `disposeProcess`.
 *
 * **Process log readers** — stdout/stderr line readers while `Running`.
 * - `children` — armed in `Running.onEntry`.
 *
 * **Graceful stop** — `Stopping` (close connections) → `Terminating` (SIGTERM, kill grace)
 * → `ProcessDetaching` (drain log readers).
 * - `killGraceTimer` — SIGTERM is sent on `Terminating` entry; SIGKILL fires after grace.
 *   "Has SIGTERM been sent?" is the `Stopping` vs `Terminating` distinction, not a flag.
 * - `shutdownRequested` — latched out-of-band intent from `requestShutdown()`. It is
 *   orthogonal to the lifecycle (can arrive in any state) and only selects the terminal
 *   leaf (`ShuttingDown` vs restartable `Stopped`), so it stays a flag rather than a state.
 * - `pendingLogReaderInterrupts` — count of log-reader interrupt acks still outstanding;
 *   `ProcessDetaching` completes when it reaches zero (a join counter, not paired booleans).
 *
 * **Supervisor wiring** — set in `Uninitialized.initialize()`.
 * - `serverMailbox` — inbound ref for child actors and internal `notify`.
 *
 * **Connection registry** — live `createConnection` children (TCP sessions).
 * - `connections`, `connectionSeq` (private).
 *
 * **Diagnostics**
 * - `lastExit` — last observed exit metadata.
 */
export class CBServerContext implements ICBServerContext {
  readonly config: CBServerConfig;
  readonly statusEvents = new EventEmitter();
  readonly processIoEvents = new EventEmitter();
  readonly connections: Map<string, CBConnectionActor> = new Map();
  processSubscription?: ihsm.Disposable;
  killGraceTimer?: number;
  pid?: number;
  shutdownRequested = false;
  children?: CBServerLogChildren;
  lastExit?: CBServerLastExit;
  serverMailbox?: CBServerActorRef;
  tcpPortProbeAttempt = 0;
  tcpPortProbeRetryTimer?: number;
  pendingLogReaderInterrupts = 0;
  private connectionSeq = 0;

  constructor(config: CBServerConfig) {
    this.config = config;
  }

  recordLastExit(code: number | null, signal: NodeJS.Signals | null, errorMessage?: string): void {
    this.lastExit = { code, signal, errorMessage };
  }

  resetForStart(): void {
    this.lastExit = undefined;
    this.pendingLogReaderInterrupts = 0;
    this.tcpPortProbeAttempt = 0;
    this.tcpPortProbeRetryTimer = undefined;
  }

  disposeProcess(): void {
    this.processSubscription?.dispose();
    this.processSubscription = undefined;
    this.pid = undefined;
  }

  resetIdle(): void {
    this.disposeProcess();
    this.pendingLogReaderInterrupts = 0;
    this.tcpPortProbeAttempt = 0;
    this.tcpPortProbeRetryTimer = undefined;
  }

  resetShutdown(): void {
    this.disposeProcess();
    this.pendingLogReaderInterrupts = 0;
  }

  allocConnectionId(): string {
    this.connectionSeq += 1;
    return `conn-${this.connectionSeq}`;
  }

  registerConnection(id: string, actor: CBConnectionActor): void {
    if (this.connections.has(id)) {
      throw new Error(`invariant violation: connection ${id} is already registered`);
    }
    this.connections.set(id, actor);
  }

  unregisterConnection(id: string): void {
    this.connections.delete(id);
  }

  clearConnections(): void {
    this.connections.clear();
  }

  beginDetachChildren(): void {
    this.pendingLogReaderInterrupts = this.children === undefined ? 0 : 2;
  }

  dispatchInterruptToChildren(): void {
    const children: CBServerLogChildren | undefined = this.children;
    if (children === undefined) {
      return;
    }
    children.stdoutLogReader.notify.interrupt();
    children.stderrLogReader.notify.interrupt();
    this.children = undefined;
  }

  noteLogReaderInterrupted(): void {
    this.pendingLogReaderInterrupts -= 1;
  }

  allInterrupted(): boolean {
    return this.pendingLogReaderInterrupts <= 0;
  }
}
