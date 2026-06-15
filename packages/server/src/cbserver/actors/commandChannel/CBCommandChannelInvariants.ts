/**
 * Hierarchical state invariants for {@link CBCommandChannelTop}.
 */
import type { ICBCommandChannelContext } from "./CBCommandChannelContext";

const tag = (state: string) => `invariant violation [${state}]`;

export function assertCommandUninitialized(ctx: ICBCommandChannelContext): void {
  if (ctx.closed) {
    throw new Error(`${tag("CommandUninitialized")}: closed must be false`);
  }
  if (ctx.connectionId.length === 0) {
    throw new Error(`${tag("CommandUninitialized")}: connectionId must be set`);
  }
  if (ctx.enrolled) {
    throw new Error(`${tag("CommandUninitialized")}: enrolled must be false`);
  }
}

export function assertCommandConnecting(ctx: ICBCommandChannelContext): void {
  assertCommandUninitialized(ctx);
}

export function assertCommandTransport(ctx: ICBCommandChannelContext): void {
  if (ctx.children === undefined) {
    throw new Error(`${tag("CommandTransport")}: tcp children must be spawned`);
  }
}

export function assertCommandSession(ctx: ICBCommandChannelContext): void {
  assertCommandTransport(ctx);
  if (ctx.closed) {
    throw new Error(`${tag("CommandSession")}: closed must be false`);
  }
  if (!ctx.enrolled) {
    throw new Error(`${tag("CommandSession")}: enrolled must be true`);
  }
}

export function assertCommandIdle(ctx: ICBCommandChannelContext): void {
  assertCommandSession(ctx);
  if (ctx.activeRequest !== undefined) {
    throw new Error(`${tag("CommandIdle")}: no command may be active`);
  }
  if (ctx.requestQueue.length > 0) {
    throw new Error(`${tag("CommandIdle")}: request queue must be empty`);
  }
}

export function assertRequestProcessing(ctx: ICBCommandChannelContext): void {
  assertCommandTransport(ctx);
  if (ctx.requestQueue.length === 0 && ctx.activeRequest === undefined) {
    throw new Error(`${tag("RequestProcessing")}: queue or active request required`);
  }
}

export function assertWriting(ctx: ICBCommandChannelContext): void {
  assertRequestProcessing(ctx);
  if (ctx.activeRequest === undefined || ctx.pendingFrame === undefined) {
    throw new Error(`${tag("Writing")}: active request and pending frame required`);
  }
}

export function assertReading(ctx: ICBCommandChannelContext): void {
  assertRequestProcessing(ctx);
  if (ctx.activeRequest === undefined) {
    throw new Error(`${tag("Reading")}: active request must be set`);
  }
}

export function assertCommandClosing(ctx: ICBCommandChannelContext): void {
  assertCommandTransport(ctx);
  if (!ctx.closed) {
    throw new Error(`${tag("CommandClosing")}: closed must be true`);
  }
}

export function assertCommandTerminal(ctx: ICBCommandChannelContext): void {
  if (!ctx.closed) {
    throw new Error(`${tag("CommandTerminal")}: closed must be true`);
  }
}

export function assertCommandDetaching(ctx: ICBCommandChannelContext): void {
  assertCommandTerminal(ctx);
}

export function assertCommandDetachingAfterInterrupt(ctx: ICBCommandChannelContext): void {
  assertCommandDetaching(ctx);
  if (ctx.children !== undefined) {
    throw new Error(`${tag("CommandDetaching")}: tcp children must be cleared after interrupt`);
  }
}

export function assertCommandClosed(ctx: ICBCommandChannelContext): void {
  assertCommandTerminal(ctx);
  if (ctx.children !== undefined) {
    throw new Error(`${tag("CommandClosed")}: tcp children must be disarmed`);
  }
  if (ctx.brokenReason !== undefined) {
    throw new Error(`${tag("CommandClosed")}: brokenReason must be unset`);
  }
}

export function assertCommandBroken(ctx: ICBCommandChannelContext): void {
  assertCommandTerminal(ctx);
  if (ctx.brokenReason === undefined || ctx.brokenReason.length === 0) {
    throw new Error(`${tag("CommandBroken")}: brokenReason must be set`);
  }
}
