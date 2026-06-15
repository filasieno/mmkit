/**
 * Hierarchical state invariants for the {@link CBNotificationChannelTop} notification channel.
 *
 * Parallel to the command channel but optimized for server-push notifications:
 * `getNotificationMessage` blocks in {@link assertNotificationAwaiting} until a frame
 * arrives or timeout fires.
 *
 * @module cbserver/actors/notificationChannel/CBNotificationChannelInvariants
 */
import type { ICBNotificationChannelContext } from "./CBNotificationChannelContext";

const tag = (state: string) => `invariant violation [${state}]`;

/**
 * **NotificationUninitialized** leaf — constructed, not enrolled.
 *
 * **Why:** Same bootstrap shape as command channel: `connectionId` set, not `closed`,
 * not `enrolled` until ENROLL_ME on this socket completes.
 *
 * **How checked:** `!closed`, `connectionId` non-empty, `!enrolled`.
 */
export function assertNotificationUninitialized(ctx: ICBNotificationChannelContext): void {
  if (ctx.closed) {
    throw new Error(`${tag("NotificationUninitialized")}: closed must be false`);
  }
  if (ctx.connectionId.length === 0) {
    throw new Error(`${tag("NotificationUninitialized")}: connectionId must be set`);
  }
  if (ctx.enrolled) {
    throw new Error(`${tag("NotificationUninitialized")}: enrolled must be false`);
  }
}

/**
 * **NotificationConnecting** leaf — TCP handshake before transport ready.
 *
 * **How checked:** Delegates to {@link assertNotificationUninitialized}.
 */
export function assertNotificationConnecting(ctx: ICBNotificationChannelContext): void {
  assertNotificationUninitialized(ctx);
}

/**
 * **NotificationTransport** composite — reader/writer children spawned.
 *
 * **Why:** All post-connect work (enroll substates, session, closing) needs TCP children.
 *
 * **How checked:** `ctx.children !== undefined`.
 */
export function assertNotificationTransport(ctx: ICBNotificationChannelContext): void {
  if (ctx.children === undefined) {
    throw new Error(`${tag("NotificationTransport")}: tcp children must be spawned`);
  }
}

/**
 * **NotificationSession** composite — enrolled and accepting notification RPCs.
 *
 * **How checked:** {@link assertNotificationTransport}, `!closed`, `enrolled`.
 *
 * **Inherited by:** `NotificationIdle`, `NotificationAwaiting`.
 */
export function assertNotificationSession(ctx: ICBNotificationChannelContext): void {
  assertNotificationTransport(ctx);
  if (ctx.closed) {
    throw new Error(`${tag("NotificationSession")}: closed must be false`);
  }
  if (!ctx.enrolled) {
    throw new Error(`${tag("NotificationSession")}: enrolled must be true`);
  }
}

/**
 * **NotificationIdle** leaf — not waiting for a client `getNotificationMessage` call.
 *
 * **Why:** No active enroll-style request on this channel; queue empty so the next
 * `beginGetNotification` can transition to Awaiting cleanly.
 *
 * **How checked:** {@link assertNotificationSession}; no `activeRequest`; empty queue.
 */
export function assertNotificationIdle(ctx: ICBNotificationChannelContext): void {
  assertNotificationSession(ctx);
  if (ctx.activeRequest !== undefined) {
    throw new Error(`${tag("NotificationIdle")}: no enroll request may be active`);
  }
  if (ctx.requestQueue.length > 0) {
    throw new Error(`${tag("NotificationIdle")}: enroll queue must be empty`);
  }
}

/**
 * **NotificationAwaiting** leaf — blocked on server notification or timeout.
 *
 * **Why:** `pendingNotification` is the Promise resolver for the client's long-poll;
 * must exist for the duration of the await state.
 *
 * **How checked:** {@link assertNotificationSession}; `pendingNotification` defined.
 */
export function assertNotificationAwaiting(ctx: ICBNotificationChannelContext): void {
  assertNotificationSession(ctx);
  if (ctx.pendingNotification === undefined) {
    throw new Error(`${tag("NotificationAwaiting")}: pending notification waiter required`);
  }
}

/**
 * **NotificationClosing** leaf — teardown started (`closed` true, transport may remain).
 *
 * **How checked:** {@link assertNotificationTransport}, `closed === true`.
 */
export function assertNotificationClosing(ctx: ICBNotificationChannelContext): void {
  assertNotificationTransport(ctx);
  if (!ctx.closed) {
    throw new Error(`${tag("NotificationClosing")}: closed must be true`);
  }
}

/**
 * **NotificationTerminal** composite — channel closed to clients.
 *
 * **How checked:** `closed === true`.
 */
export function assertNotificationTerminal(ctx: ICBNotificationChannelContext): void {
  if (!ctx.closed) {
    throw new Error(`${tag("NotificationTerminal")}: closed must be true`);
  }
}

/**
 * **NotificationDetaching** leaf — interrupt in flight (optional on happy-path close).
 *
 * **How checked:** {@link assertNotificationTerminal}.
 */
export function assertNotificationDetaching(ctx: ICBNotificationChannelContext): void {
  assertNotificationTerminal(ctx);
}

/**
 * **NotificationClosed** leaf — graceful terminal.
 *
 * **How checked:** {@link assertNotificationTerminal}; children disarmed; no `brokenReason`.
 */
export function assertNotificationClosed(ctx: ICBNotificationChannelContext): void {
  assertNotificationTerminal(ctx);
  if (ctx.children !== undefined) {
    throw new Error(`${tag("NotificationClosed")}: tcp children must be disarmed`);
  }
  if (ctx.brokenReason !== undefined) {
    throw new Error(`${tag("NotificationClosed")}: brokenReason must be unset`);
  }
}

/**
 * **NotificationBroken** leaf — abnormal terminal.
 *
 * **How checked:** {@link assertNotificationTerminal}; non-empty `brokenReason`.
 */
export function assertNotificationBroken(ctx: ICBNotificationChannelContext): void {
  assertNotificationTerminal(ctx);
  if (ctx.brokenReason === undefined || ctx.brokenReason.length === 0) {
    throw new Error(`${tag("NotificationBroken")}: brokenReason must be set`);
  }
}
