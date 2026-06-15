/**
 * Hierarchical state invariants for the {@link CBConnectionWriterTop} length-prefixed writer.
 *
 * @module cbserver/actors/writer/CBConnectionWriterInvariants
 */
import type { ICBConnectionWriterContext } from "./CBConnectionWriterContext";

const tag = (state: string) => `invariant violation [${state}]`;

/**
 * **WriterUninitialized** leaf — constructed; `initialize()` not called.
 *
 * **Why:** No interrupt may be pending before the parent registers the writer.
 *
 * **How checked:** `interrupted === false`.
 */
export function assertWriterUninitialized(ctx: ICBConnectionWriterContext): void {
  if (ctx.interrupted) {
    throw new Error(`${tag("WriterUninitialized")}: interrupted must be false`);
  }
}

/**
 * **WriterInitialized** composite — parent may call `sendFrame` / `interrupt`.
 *
 * **Why:** `interruptedPosted` pairs with `interrupted` like the reader actor.
 *
 * **How checked:** `interruptedPosted` implies `interrupted`.
 *
 * **Inherited by:** `WriterIdle`, `WriterSending`, `WriterStopped`.
 */
export function assertWriterInitialized(ctx: ICBConnectionWriterContext): void {
  if (ctx.interruptedPosted && !ctx.interrupted) {
    throw new Error(`${tag("WriterInitialized")}: interruptedPosted requires interrupted`);
  }
}

/**
 * **WriterIdle** leaf — ready for the next `sendFrame` call.
 *
 * **Why:** Only one socket write at a time; idle means not interrupted.
 *
 * **How checked:** {@link assertWriterInitialized}, `!interrupted`.
 */
export function assertWriterIdle(ctx: ICBConnectionWriterContext): void {
  assertWriterInitialized(ctx);
  if (ctx.interrupted) {
    throw new Error(`${tag("WriterIdle")}: interrupted must be false`);
  }
}

/**
 * **WriterSending** leaf — `sendFrame` accepted; awaiting write completion callback.
 *
 * **How checked:** {@link assertWriterInitialized}, `!interrupted`.
 */
export function assertWriterSending(ctx: ICBConnectionWriterContext): void {
  assertWriterInitialized(ctx);
  if (ctx.interrupted) {
    throw new Error(`${tag("WriterSending")}: interrupted must be false`);
  }
}

/**
 * **WriterStopped** leaf — interrupt posted; late write completions ignored.
 *
 * **How checked:** {@link assertWriterInitialized}, `interrupted === true`.
 */
export function assertWriterStopped(ctx: ICBConnectionWriterContext): void {
  assertWriterInitialized(ctx);
  if (!ctx.interrupted) {
    throw new Error(`${tag("WriterStopped")}: interrupted must be true`);
  }
}
