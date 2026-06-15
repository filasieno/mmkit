/**
 * State invariants for the stdout process log line-reader ({@link StdoutLogReaderTop}).
 *
 * Child of {@link CBServerTop}; converts raw stdout chunks into newline-delimited lines
 * forwarded to the supervisor via `onStdoutLine`.
 *
 * @module cbserver/actors/stdoutLogReader/CBServerStdoutLogReaderInvariants
 */
import type { IStdoutLogReaderContext } from "./CBServerStdoutLogReaderContext";

const tag = (state: string) => `invariant violation [${state}]`;

/** Line buffer must be empty when the reader is disarmed. */
export function assertStdoutLogDisarmed(ctx: IStdoutLogReaderContext): void {
  if (ctx.lineBuffer.length > 0) {
    throw new Error("invariant violation: stdout log buffer must be empty when disarmed");
  }
}

/**
 * **StdoutLogInitialized** composite — past `initialize()`; may be idle or stopped.
 *
 * **Why:** Once interrupt is requested, partial lines in `lineBuffer` must be flushed or
 * dropped before we stop emitting — otherwise clients would see log lines after teardown.
 *
 * **How checked:** If `interrupted` then `lineBuffer.length === 0`.
 *
 * **Inherited by:** `StdoutLogIdle`, `StdoutLogStopped`.
 */
export function assertStdoutLogInitialized(ctx: IStdoutLogReaderContext): void {
  if (ctx.interrupted && ctx.lineBuffer.length > 0) {
    throw new Error(`${tag("StdoutLogInitialized")}: line buffer must be empty when interrupted`);
  }
}

/**
 * **StdoutLogUninitialized** leaf — actor created; not consuming stdout yet.
 *
 * **Why:** `initialize()` must start from a clean buffer and no interrupt flags.
 * `assertDisarmed()` ensures no supervisor callback is registered prematurely.
 *
 * **How checked:** `ctx.assertDisarmed()`, `!interrupted`.
 */
export function assertStdoutLogUninitialized(ctx: IStdoutLogReaderContext): void {
  assertStdoutLogDisarmed(ctx);
  if (ctx.interrupted) {
    throw new Error(`${tag("StdoutLogUninitialized")}: interrupted must be false`);
  }
}

/**
 * **StdoutLogStopped** leaf — terminal; interrupt ack sent to supervisor.
 *
 * **Why:** Reader must be disarmed and satisfy initialized interrupt/buffer rules.
 *
 * **How checked:** {@link assertStdoutLogInitialized}, `ctx.assertDisarmed()`.
 */
export function assertStdoutLogStopped(ctx: IStdoutLogReaderContext): void {
  assertStdoutLogInitialized(ctx);
  assertStdoutLogDisarmed(ctx);
}

/**
 * **StdoutLogIdle** leaf — accepting `onData` chunks and emitting complete lines.
 *
 * **How checked:** {@link assertStdoutLogInitialized} only (interrupt may still be false).
 */
export function assertStdoutLogIdle(ctx: IStdoutLogReaderContext): void {
  assertStdoutLogInitialized(ctx);
}
