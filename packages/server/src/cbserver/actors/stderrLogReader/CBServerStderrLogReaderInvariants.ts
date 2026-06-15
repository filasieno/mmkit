/**
 * State invariants for the stderr process log line-reader ({@link StderrLogReaderTop}).
 *
 * Mirror of stdout reader; forwards `onStderrLine` to the supervisor.
 *
 * @module cbserver/actors/stderrLogReader/CBServerStderrLogReaderInvariants
 */
import type { IStderrReaderContext } from "./CBServerStderrReaderContext";

const tag = (state: string) => `invariant violation [${state}]`;

/** Line buffer must be empty when the reader is disarmed. */
export function assertStderrLogDisarmed(ctx: IStderrReaderContext): void {
  if (ctx.lineBuffer.length > 0) {
    throw new Error("invariant violation: stderr line buffer must be empty when disarmed");
  }
}

/**
 * **StderrInitialized** composite — past `initialize()`.
 *
 * **Why:** Same buffer discipline as stdout — no buffered bytes after interrupt.
 *
 * **How checked:** If `interrupted` then empty `lineBuffer`.
 *
 * **Inherited by:** `StderrIdle`, `StderrStopped`.
 */
export function assertStderrLogInitialized(ctx: IStderrReaderContext): void {
  if (ctx.interrupted && ctx.lineBuffer.length > 0) {
    throw new Error(`${tag("StderrInitialized")}: line buffer must be empty when interrupted`);
  }
}

/**
 * **StderrUninitialized** leaf — not yet consuming stderr.
 *
 * **How checked:** `ctx.assertDisarmed()`, `!interrupted`.
 */
export function assertStderrLogUninitialized(ctx: IStderrReaderContext): void {
  assertStderrLogDisarmed(ctx);
  if (ctx.interrupted) {
    throw new Error(`${tag("StderrUninitialized")}: interrupted must be false`);
  }
}

/**
 * **StderrStopped** leaf — terminal after interrupt ack.
 *
 * **How checked:** {@link assertStderrLogInitialized}, `ctx.assertDisarmed()`.
 */
export function assertStderrLogStopped(ctx: IStderrReaderContext): void {
  assertStderrLogInitialized(ctx);
  assertStderrLogDisarmed(ctx);
}

/**
 * **StderrIdle** leaf — forwarding complete stderr lines to supervisor.
 *
 * **How checked:** {@link assertStderrLogInitialized}.
 */
export function assertStderrLogIdle(ctx: IStderrReaderContext): void {
  assertStderrLogInitialized(ctx);
}
