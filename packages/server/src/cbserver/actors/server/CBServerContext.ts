import { EventEmitter } from "node:events";
import * as ihsm from "ihsm";
import type { CBServerConfig, CBServerActorRef } from "./CBServerConfig";
import type { CBConnectionActor, CBConnectionRegistry } from "../connection/CBServerConnectionConfig";
import type { CBStderrLogReaderActor } from "../stderrLogReader/CBServerStderrReaderConfig";
import type { CBStdoutLogReaderActor } from "../stdoutLogReader/CBServerStdoutLogReaderConfig";

/**
 * Log line readers armed while the subprocess is active.
 *
 * Ports are owned by ihsm on each child — not stored here.
 */
export type CBServerLogChildren = {
  stdoutLogReader: CBStdoutLogReaderActor;
  stderrLogReader: CBStderrLogReaderActor;
};

/** Last subprocess stop observed — diagnostics/tests only. */
export type CBServerLastExit = {
  code: number | null;
  signal: NodeJS.Signals | null;
  errorMessage?: string;
};

export type CBServerConnectionRegistry = CBConnectionRegistry;

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
 * **Graceful stop** — `Stopping` → `ProcessDetaching`.
 * - `killSignaled`, `killGraceTimer` — SIGTERM then optional SIGKILL after grace.
 * - `shutdownRequested` — `requestShutdown()`; chooses `ShuttingDown` vs `Stopped`.
 * - `detachTarget` — destination leaf after log readers acknowledge interrupt.
 * - `awaitStdoutLogReaderInterrupted`, `awaitStderrLogReaderInterrupted`.
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
export interface ICBServerContext {
  readonly config: CBServerConfig;
  readonly statusEvents: EventEmitter;
  readonly processIoEvents: EventEmitter;
  readonly connections: CBServerConnectionRegistry;
  processSubscription?: ihsm.Disposable;
  killGraceTimer?: number;
  detachTarget: "stopped" | "shuttingDown";
  awaitStdoutLogReaderInterrupted: boolean;
  awaitStderrLogReaderInterrupted: boolean;
  pid?: number;
  shutdownRequested: boolean;
  killSignaled: boolean;
  children?: CBServerLogChildren;
  lastExit?: CBServerLastExit;
  serverMailbox?: CBServerActorRef;
  assertSpawnArmed(): void;
  assertProcessArmed(): void;
  assertProcessDisarmed(): void;
  assertIdle(): void;
  recordLastExit(code: number | null, signal: NodeJS.Signals | null, errorMessage?: string): void;
  resetForStart(): void;
  disposeProcess(): void;
  resetIdle(): void;
  resetShutdown(): void;
  allocConnectionId(): string;
  registerConnection(id: string, actor: CBConnectionActor): void;
  unregisterConnection(id: string): void;
  clearConnections(): void;
  beginDetachChildren(target: "stopped" | "shuttingDown"): void;
  dispatchInterruptToChildren(): void;
  noteStdoutLogReaderInterrupted(): void;
  noteStderrLogReaderInterrupted(): void;
  allInterrupted(): boolean;
}

/** Domain data for the CBServer actor — mutated from state handlers only. */
export class CBServerContext implements ICBServerContext {
  readonly config: CBServerConfig;
  readonly statusEvents = new EventEmitter();
  readonly processIoEvents = new EventEmitter();
  readonly connections: CBServerConnectionRegistry = new Map();
  processSubscription?: ihsm.Disposable;
  killGraceTimer?: number;
  detachTarget: "stopped" | "shuttingDown" = "stopped";
  awaitStdoutLogReaderInterrupted = false;
  awaitStderrLogReaderInterrupted = false;
  pid?: number;
  shutdownRequested = false;
  killSignaled = false;
  children?: CBServerLogChildren;
  lastExit?: CBServerLastExit;
  serverMailbox?: CBServerActorRef;
  private connectionSeq = 0;

  constructor(config: CBServerConfig) {
    this.config = config;
  }

  assertSpawnArmed(): void {
    if (this.processSubscription === undefined || this.pid === undefined) {
      throw new Error("invariant violation: process subscription must be armed");
    }
  }

  assertProcessArmed(): void {
    this.assertSpawnArmed();
    if (this.children === undefined) {
      throw new Error("invariant violation: log readers must be armed while process is active");
    }
  }

  assertProcessDisarmed(): void {
    if (this.processSubscription !== undefined || this.pid !== undefined) {
      throw new Error("invariant violation: process subscription must be disarmed");
    }
    if (this.children !== undefined) {
      throw new Error("invariant violation: log readers must be disarmed");
    }
  }

  assertIdle(): void {
    this.assertProcessDisarmed();
    if (this.killSignaled) {
      throw new Error("invariant violation: killSignaled must be false when idle");
    }
  }

  recordLastExit(code: number | null, signal: NodeJS.Signals | null, errorMessage?: string): void {
    this.lastExit = { code, signal, errorMessage };
  }

  resetForStart(): void {
    this.lastExit = undefined;
    this.killSignaled = false;
    this.awaitStdoutLogReaderInterrupted = false;
    this.awaitStderrLogReaderInterrupted = false;
    this.detachTarget = "stopped";
  }

  disposeProcess(): void {
    this.processSubscription?.dispose();
    this.processSubscription = undefined;
    this.pid = undefined;
  }

  resetIdle(): void {
    this.disposeProcess();
    this.killSignaled = false;
    this.awaitStdoutLogReaderInterrupted = false;
    this.awaitStderrLogReaderInterrupted = false;
    this.detachTarget = "stopped";
  }

  resetShutdown(): void {
    this.disposeProcess();
    this.awaitStdoutLogReaderInterrupted = false;
    this.awaitStderrLogReaderInterrupted = false;
    this.detachTarget = "shuttingDown";
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

  beginDetachChildren(target: "stopped" | "shuttingDown"): void {
    this.detachTarget = target;
    const children = this.children;
    if (children === undefined) {
      this.awaitStdoutLogReaderInterrupted = false;
      this.awaitStderrLogReaderInterrupted = false;
      return;
    }
    this.awaitStdoutLogReaderInterrupted = true;
    this.awaitStderrLogReaderInterrupted = true;
  }

  dispatchInterruptToChildren(): void {
    const children = this.children;
    if (children === undefined) {
      return;
    }
    if (this.awaitStdoutLogReaderInterrupted) {
      children.stdoutLogReader.notify.interrupt();
    }
    if (this.awaitStderrLogReaderInterrupted) {
      children.stderrLogReader.notify.interrupt();
    }
    this.children = undefined;
  }

  noteStdoutLogReaderInterrupted(): void {
    this.awaitStdoutLogReaderInterrupted = false;
  }

  noteStderrLogReaderInterrupted(): void {
    this.awaitStderrLogReaderInterrupted = false;
  }

  allInterrupted(): boolean {
    return !this.awaitStdoutLogReaderInterrupted && !this.awaitStderrLogReaderInterrupted;
  }
}
