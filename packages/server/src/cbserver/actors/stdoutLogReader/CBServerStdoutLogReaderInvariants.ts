/**
 * State invariants for the stdout process log line-reader ({@link StdoutLogReaderTop}).
 */
import type { IStdoutLogReaderContext } from "./CBServerStdoutLogReaderContext";

const tag = (state: string) => `invariant violation [${state}]`;

/**
 * **StdoutLogInitialized** composite — past `initialize()`.
 *
 * If teardown has started (`interrupted`), any partial line must already have
 * been flushed or dropped — we do not emit log lines after interrupt.
 */
export function assertStdoutLogInitialized(ctx: IStdoutLogReaderContext): void {
  if (ctx.interrupted && ctx.lineBuffer.length > 0) {
    throw new Error(`${tag("StdoutLogInitialized")}: line buffer must be empty when interrupted`);
  }
}

/**
 * **StdoutLogUninitialized** — actor created; not yet consuming stdout for logging.
 *
 * Line buffer empty and no interrupt flags — `initialize()` starts clean.
 */
export function assertStdoutLogUninitialized(ctx: IStdoutLogReaderContext): void {
  ctx.assertDisarmed();
  if (ctx.interrupted) {
    throw new Error(`${tag("StdoutLogUninitialized")}: interrupted must be false`);
  }
}

/**
 * **StdoutLogStopped** — terminal; buffer cleared and interrupt ack sent to supervisor.
 */
export function assertStdoutLogStopped(ctx: IStdoutLogReaderContext): void {
  assertStdoutLogInitialized(ctx);
  ctx.assertDisarmed();
}

/**
 * **StdoutLogIdle** — accepting stdout chunks and forwarding complete lines to the supervisor.
 */
export function assertStdoutLogIdle(ctx: IStdoutLogReaderContext): void {
  assertStdoutLogInitialized(ctx);
}
