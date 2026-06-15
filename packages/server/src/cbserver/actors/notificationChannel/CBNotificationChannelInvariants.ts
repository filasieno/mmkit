/**
 * Hierarchical state invariants for {@link CBNotificationChannelTop}.
 */
import type { ICBNotificationChannelContext } from "./CBNotificationChannelContext";

const tag = (state: string) => `invariant violation [${state}]`;

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

export function assertNotificationConnecting(ctx: ICBNotificationChannelContext): void {
  assertNotificationUninitialized(ctx);
}

export function assertNotificationTransport(ctx: ICBNotificationChannelContext): void {
  if (ctx.children === undefined) {
    throw new Error(`${tag("NotificationTransport")}: tcp children must be spawned`);
  }
}

export function assertNotificationSession(ctx: ICBNotificationChannelContext): void {
  assertNotificationTransport(ctx);
  if (ctx.closed) {
    throw new Error(`${tag("NotificationSession")}: closed must be false`);
  }
  if (!ctx.enrolled) {
    throw new Error(`${tag("NotificationSession")}: enrolled must be true`);
  }
}

export function assertNotificationIdle(ctx: ICBNotificationChannelContext): void {
  assertNotificationSession(ctx);
  if (ctx.activeRequest !== undefined) {
    throw new Error(`${tag("NotificationIdle")}: no enroll request may be active`);
  }
  if (ctx.requestQueue.length > 0) {
    throw new Error(`${tag("NotificationIdle")}: enroll queue must be empty`);
  }
}

export function assertNotificationAwaiting(ctx: ICBNotificationChannelContext): void {
  assertNotificationSession(ctx);
  if (ctx.pendingNotification === undefined) {
    throw new Error(`${tag("NotificationAwaiting")}: pending notification waiter required`);
  }
}

export function assertNotificationClosing(ctx: ICBNotificationChannelContext): void {
  assertNotificationTransport(ctx);
  if (!ctx.closed) {
    throw new Error(`${tag("NotificationClosing")}: closed must be true`);
  }
}

export function assertNotificationTerminal(ctx: ICBNotificationChannelContext): void {
  if (!ctx.closed) {
    throw new Error(`${tag("NotificationTerminal")}: closed must be true`);
  }
}

export function assertNotificationDetaching(ctx: ICBNotificationChannelContext): void {
  assertNotificationTerminal(ctx);
}

export function assertNotificationClosed(ctx: ICBNotificationChannelContext): void {
  assertNotificationTerminal(ctx);
  if (ctx.children !== undefined) {
    throw new Error(`${tag("NotificationClosed")}: tcp children must be disarmed`);
  }
  if (ctx.brokenReason !== undefined) {
    throw new Error(`${tag("NotificationClosed")}: brokenReason must be unset`);
  }
}

export function assertNotificationBroken(ctx: ICBNotificationChannelContext): void {
  assertNotificationTerminal(ctx);
  if (ctx.brokenReason === undefined || ctx.brokenReason.length === 0) {
    throw new Error(`${tag("NotificationBroken")}: brokenReason must be set`);
  }
}
