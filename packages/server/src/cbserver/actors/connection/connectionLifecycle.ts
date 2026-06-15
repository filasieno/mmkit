import type { CBConnectionActorHandle } from "./CBServerConnectionConfig";
import type { ICBConnectionContext } from "./CBServerConnectionContext";
import { waitForConnectionClose } from "./CBServerConnectionContext";

/**
 * Graceful dual-channel close.
 *
 * The completion waiter is armed **directly on the context** (never via a service): an
 * ihsm service that returns a long-lived promise would block the actor mailbox until that
 * promise settles — so the `close` notification queued behind it would never run and the
 * close could never complete. Arming `pendingClose` synchronously (the same idiom as
 * {@link waitForConnectionBootstrap}) before posting `close` guarantees the waiter is in
 * place when {@link CBConnectionContext.resolvePendingClose} fires.
 *
 * When `ctx` is omitted (e.g. callers that observe completion out-of-band, such as the
 * supervisor connection registry shrinking) this only posts the trigger and resolves once
 * the notification has been enqueued.
 */
export async function closeConnection( actor: CBConnectionActorHandle, ctx?: ICBConnectionContext ): Promise<void> {
  const closed: Promise<void> = ctx !== undefined ? waitForConnectionClose(ctx) : Promise.resolve();
  actor.notify.close();
  await closed;
}
