/**
 * Hierarchical state invariants for {@link CBConnectionWriterTop}.
 */
import type { ICBConnectionWriterContext } from "./CBConnectionWriterContext";

const tag = (state: string) => `invariant violation [${state}]`;

/** Writer actor constructed; not yet initialized. */
export function assertWriterUninitialized(ctx: ICBConnectionWriterContext): void {
  if (ctx.interrupted) {
    throw new Error(`${tag("WriterUninitialized")}: interrupted must be false`);
  }
}

/** Writer initialized; parent connection may post send/interrupt events. */
export function assertWriterInitialized(ctx: ICBConnectionWriterContext): void {
  if (ctx.interruptedPosted && !ctx.interrupted) {
    throw new Error(`${tag("WriterInitialized")}: interruptedPosted requires interrupted`);
  }
}

/** Ready to accept the next length-prefixed frame. */
export function assertWriterIdle(ctx: ICBConnectionWriterContext): void {
  assertWriterInitialized(ctx);
  if (ctx.interrupted) {
    throw new Error(`${tag("WriterIdle")}: interrupted must be false`);
  }
}

/** Socket write in flight for the current frame. */
export function assertWriterSending(ctx: ICBConnectionWriterContext): void {
  assertWriterInitialized(ctx);
  if (ctx.interrupted) {
    throw new Error(`${tag("WriterSending")}: interrupted must be false`);
  }
}

/** Interrupt posted; late write completions must be ignored. */
export function assertWriterStopped(ctx: ICBConnectionWriterContext): void {
  assertWriterInitialized(ctx);
  if (!ctx.interrupted) {
    throw new Error(`${tag("WriterStopped")}: interrupted must be true`);
  }
}
