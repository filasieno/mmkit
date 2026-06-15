/**
 * Hierarchical state invariants for {@link CBConnectionTop} orchestrator.
 */
import type { ICBConnectionContext } from "./CBServerConnectionContext";

const tag = (state: string) => `invariant violation [${state}]`;

export function assertConnectionUninitialized(ctx: ICBConnectionContext): void {
  if (ctx.closed) {
    throw new Error(`${tag("ConnectionUninitialized")}: closed must be false`);
  }
  if (ctx.connectionId.length === 0) {
    throw new Error(`${tag("ConnectionUninitialized")}: connectionId must be set`);
  }
  if (ctx.commandChannel !== undefined || ctx.notificationChannel !== undefined) {
    throw new Error(`${tag("ConnectionUninitialized")}: channels must not be spawned yet`);
  }
}

export function assertConnecting(ctx: ICBConnectionContext): void {
  assertConnectionUninitialized(ctx);
}

export function assertConnectionIdle(ctx: ICBConnectionContext): void {
  if (ctx.closed) {
    throw new Error(`${tag("ConnectionIdle")}: closed must be false`);
  }
  if (ctx.commandChannel === undefined || ctx.notificationChannel === undefined) {
    throw new Error(`${tag("ConnectionIdle")}: both channels must be spawned`);
  }
  if (ctx.commandCtx === undefined || !ctx.commandCtx.enrolled) {
    throw new Error(`${tag("ConnectionIdle")}: command channel must be enrolled`);
  }
  if (ctx.notificationCtx === undefined || !ctx.notificationCtx.enrolled) {
    throw new Error(`${tag("ConnectionIdle")}: notification channel must be enrolled`);
  }
}

export function assertConnectionClosing(ctx: ICBConnectionContext): void {
  if (!ctx.closed) {
    throw new Error(`${tag("ConnectionClosing")}: closed must be true`);
  }
}

export function assertConnectionTerminal(ctx: ICBConnectionContext): void {
  if (!ctx.closed) {
    throw new Error(`${tag("ConnectionTerminal")}: closed must be true`);
  }
}

export function assertConnectionClosed(ctx: ICBConnectionContext): void {
  assertConnectionTerminal(ctx);
  if (ctx.brokenReason !== undefined) {
    throw new Error(`${tag("ConnectionClosed")}: brokenReason must be unset`);
  }
  if (!ctx.bothChannelsClosed()) {
    throw new Error(`${tag("ConnectionClosed")}: both channels must be closed`);
  }
}

export function assertConnectionBroken(ctx: ICBConnectionContext): void {
  assertConnectionTerminal(ctx);
  if (ctx.brokenReason === undefined || ctx.brokenReason.length === 0) {
    throw new Error(`${tag("ConnectionBroken")}: brokenReason must be set`);
  }
}
