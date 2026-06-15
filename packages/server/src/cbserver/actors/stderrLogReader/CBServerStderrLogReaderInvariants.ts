/**
 * State invariants for the stderr process log line-reader ({@link StderrLogReaderTop}).
 */
import type { IStderrReaderContext } from "./CBServerStderrReaderContext";

const tag = (state: string) => `invariant violation [${state}]`;

/**
 * **StderrInitialized** composite — past `initialize()`.
 *
 * If teardown has started (`interrupted`), any partial line must already have
 * been flushed or dropped — we do not emit log lines after interrupt.
 */
export function assertStderrLogInitialized(ctx: IStderrReaderContext): void {
  if (ctx.interrupted && ctx.lineBuffer.length > 0) {
    throw new Error(`${tag("StderrInitialized")}: line buffer must be empty when interrupted`);
  }
}

/**
 * **StderrUninitialized** — actor created; not yet consuming stderr.
 *
 * Line buffer empty and no interrupt flags — `initialize()` starts clean.
 */
export function assertStderrLogUninitialized(ctx: IStderrReaderContext): void {
  ctx.assertDisarmed();
  if (ctx.interrupted) {
    throw new Error(`${tag("StderrUninitialized")}: interrupted must be false`);
  }
}

/**
 * **StderrStopped** — terminal; buffer cleared and interrupt ack sent to supervisor.
 */
export function assertStderrLogStopped(ctx: IStderrReaderContext): void {
  assertStderrLogInitialized(ctx);
  ctx.assertDisarmed();
}

/**
 * **StderrIdle** — accepting stderr chunks and forwarding complete lines to the supervisor.
 */
export function assertStderrLogIdle(ctx: IStderrReaderContext): void {
  assertStderrLogInitialized(ctx);
}
