/**
 * Hierarchical state invariants for {@link CBConnectionReaderTop}.
 */
import type { ICBConnectionReaderContext } from "./CBConnectionReaderContext";

const tag = (state: string) => `invariant violation [${state}]`;

/** Reader actor constructed; not yet initialized. */
export function assertReaderUninitialized(ctx: ICBConnectionReaderContext): void {
  if (ctx.interrupted) {
    throw new Error(`${tag("ReaderUninitialized")}: interrupted must be false`);
  }
}

/** Reader initialized; parent connection may post stream events. */
export function assertReaderInitialized(ctx: ICBConnectionReaderContext): void {
  if (ctx.interruptedPosted && !ctx.interrupted) {
    throw new Error(`${tag("ReaderInitialized")}: interruptedPosted requires interrupted`);
  }
}

/** Accepting spontaneous notifications; not awaiting a command answer. */
export function assertReaderIdle(ctx: ICBConnectionReaderContext): void {
  assertReaderInitialized(ctx);
  if (ctx.interrupted) {
    throw new Error(`${tag("ReaderIdle")}: interrupted must be false`);
  }
}

/** Blocking until the next non-notification ipcanswer. */
export function assertReaderAwaiting(ctx: ICBConnectionReaderContext): void {
  assertReaderInitialized(ctx);
  if (ctx.interrupted) {
    throw new Error(`${tag("ReaderAwaiting")}: interrupted must be false`);
  }
}

/** Interrupt posted; late stream events must be ignored. */
export function assertReaderStopped(ctx: ICBConnectionReaderContext): void {
  assertReaderInitialized(ctx);
  if (!ctx.interrupted) {
    throw new Error(`${tag("ReaderStopped")}: interrupted must be true`);
  }
}
