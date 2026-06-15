/**
 * Hierarchical state invariants for the {@link CBConnectionReaderTop} IPC frame reader.
 *
 * Shared by command and notification channels. Distinguishes spontaneous notification
 * frames (handled in {@link assertReaderIdle}) from command answer wait
 * ({@link assertReaderAwaiting}).
 *
 * @module cbserver/actors/reader/CBConnectionReaderInvariants
 */
import type { ICBConnectionReaderContext } from "./CBConnectionReaderContext";

const tag = (state: string) => `invariant violation [${state}]`;

/**
 * **ReaderUninitialized** leaf — constructed; `initialize()` not called.
 *
 * **Why:** Interrupt must not be set before the parent wires stream callbacks.
 *
 * **How checked:** `interrupted === false`.
 */
export function assertReaderUninitialized(ctx: ICBConnectionReaderContext): void {
  if (ctx.interrupted) {
    throw new Error(`${tag("ReaderUninitialized")}: interrupted must be false`);
  }
}

/**
 * **ReaderInitialized** composite — parent may post stream and interrupt events.
 *
 * **Why:** `interruptedPosted` is set only after `interrupt()` runs; it implies
 * `interrupted` so we do not ack twice or post answers after teardown.
 *
 * **How checked:** If `interruptedPosted` then `interrupted` must be true.
 *
 * **Inherited by:** `ReaderIdle`, `ReaderAwaiting`, `ReaderStopped`.
 */
export function assertReaderInitialized(ctx: ICBConnectionReaderContext): void {
  if (ctx.interruptedPosted && !ctx.interrupted) {
    throw new Error(`${tag("ReaderInitialized")}: interruptedPosted requires interrupted`);
  }
}

/**
 * **ReaderIdle** leaf — accepting spontaneous notification frames; not awaiting answer.
 *
 * **Why:** Command channel posts `beginAwait` only when entering Reading; idle means
 * no blocking read for ipcanswer.
 *
 * **How checked:** {@link assertReaderInitialized}, `!interrupted`.
 */
export function assertReaderIdle(ctx: ICBConnectionReaderContext): void {
  assertReaderInitialized(ctx);
  if (ctx.interrupted) {
    throw new Error(`${tag("ReaderIdle")}: interrupted must be false`);
  }
}

/**
 * **ReaderAwaiting** leaf — blocked until next non-notification ipcanswer.
 *
 * **Why:** Same interrupt rule as idle; parent must not be in idle when await is active
 * (enforced by channel state machine, not reader context fields).
 *
 * **How checked:** {@link assertReaderInitialized}, `!interrupted`.
 */
export function assertReaderAwaiting(ctx: ICBConnectionReaderContext): void {
  assertReaderInitialized(ctx);
  if (ctx.interrupted) {
    throw new Error(`${tag("ReaderAwaiting")}: interrupted must be false`);
  }
}

/**
 * **ReaderStopped** leaf — interrupt posted; late stream events swallowed by parent.
 *
 * **Why:** After interrupt, bytes on the socket must not produce answers or notifications.
 *
 * **How checked:** {@link assertReaderInitialized}, `interrupted === true`.
 */
export function assertReaderStopped(ctx: ICBConnectionReaderContext): void {
  assertReaderInitialized(ctx);
  if (!ctx.interrupted) {
    throw new Error(`${tag("ReaderStopped")}: interrupted must be true`);
  }
}
