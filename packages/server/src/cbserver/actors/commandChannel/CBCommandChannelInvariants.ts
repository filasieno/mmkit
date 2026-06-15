/**
 * Hierarchical state invariants for the {@link CBCommandChannelTop} TCP command channel.
 *
 * Models the request pipeline: idle → dequeue → {@link assertWriting} → socket →
 * {@link assertReading} → `doReadComplete` (branches on IPC **method** parameter, not
 * extra states).
 *
 * ## Terminal layer
 *
 * `CommandTerminal` descendants swallow late reader/writer/socket events so teardown
 * races do not surface as `UnhandledEventError`.
 *
 * @module cbserver/actors/commandChannel/CBCommandChannelInvariants
 */
import type { ICBCommandChannelContext } from "./CBCommandChannelContext";

const tag = (state: string) => `invariant violation [${state}]`;

/**
 * **CommandUninitialized** leaf — channel constructed, not enrolled.
 *
 * **Why:** `connectionId` identifies the parent connection; `enrolled` must be false
 * until ENROLL_ME succeeds; `closed` false until explicit close/break.
 *
 * **How checked:** `!closed`, `connectionId` set, `!enrolled`.
 */
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

/**
 * **CommandConnecting** leaf — TCP connect + reader/writer spawn before transport ready.
 *
 * **How checked:** Same as {@link assertCommandUninitialized}.
 */
export function assertCommandConnecting(ctx: ICBCommandChannelContext): void {
  assertCommandUninitialized(ctx);
}

/**
 * **CommandTransport** composite — reader and writer child actors exist.
 *
 * **Why:** All IPC after connect shares the TCP stack; session, closing, and request
 * processing all require `ctx.children` (reader + writer handles).
 *
 * **How checked:** `ctx.children !== undefined`.
 *
 * **Inherited by:** `CommandSession`, `CommandClosing`, `RequestProcessing`, `Writing`, `Reading`.
 */
export function assertCommandTransport(ctx: ICBCommandChannelContext): void {
  if (ctx.children === undefined) {
    throw new Error(`${tag("CommandTransport")}: tcp children must be spawned`);
  }
}

/**
 * **CommandSession** composite — ENROLL_ME completed; channel accepts commands.
 *
 * **Why:** `enrolled` mirrors Java session; `closed` false while session active.
 *
 * **How checked:** {@link assertCommandTransport}, `!closed`, `enrolled === true`.
 *
 * **Inherited by:** `CommandIdle`, `RequestProcessing` (when session still valid).
 */
export function assertCommandSession(ctx: ICBCommandChannelContext): void {
  assertCommandTransport(ctx);
  if (ctx.closed) {
    throw new Error(`${tag("CommandSession")}: closed must be false`);
  }
  if (!ctx.enrolled) {
    throw new Error(`${tag("CommandSession")}: enrolled must be true`);
  }
}

/**
 * **CommandIdle** leaf — no in-flight command; queue drained.
 *
 * **Why:** Only one command is processed at a time; idle means no `activeRequest` and
 * empty `requestQueue` so `dispatchIpc` can start a new pipeline immediately.
 *
 * **How checked:** {@link assertCommandSession}; no active request; queue length 0.
 */
export function assertCommandIdle(ctx: ICBCommandChannelContext): void {
  assertCommandSession(ctx);
  if (ctx.activeRequest !== undefined) {
    throw new Error(`${tag("CommandIdle")}: no command may be active`);
  }
  if (ctx.requestQueue.length > 0) {
    throw new Error(`${tag("CommandIdle")}: request queue must be empty`);
  }
}

/**
 * **RequestProcessing** composite — at least one command is being served.
 *
 * **Why:** Either the queue has a pending request or `activeRequest` is set for the
 * current write/read cycle.
 *
 * **How checked:** {@link assertCommandTransport}; queue non-empty OR `activeRequest` set.
 *
 * **Inherited by:** `Writing`, `Reading`.
 */
export function assertRequestProcessing(ctx: ICBCommandChannelContext): void {
  assertCommandTransport(ctx);
  if (ctx.requestQueue.length === 0 && ctx.activeRequest === undefined) {
    throw new Error(`${tag("RequestProcessing")}: queue or active request required`);
  }
}

/**
 * **Writing** leaf — length-prefixed frame queued on the writer socket.
 *
 * **Why:** `pendingFrame` must exist while the writer actor emits bytes; `activeRequest`
 * ties the frame to the command being answered.
 *
 * **How checked:** {@link assertRequestProcessing}; `activeRequest` and `pendingFrame` defined.
 */
export function assertWriting(ctx: ICBCommandChannelContext): void {
  assertRequestProcessing(ctx);
  if (ctx.activeRequest === undefined || ctx.pendingFrame === undefined) {
    throw new Error(`${tag("Writing")}: active request and pending frame required`);
  }
}

/**
 * **Reading** leaf — awaiting ipcanswer frame from reader.
 *
 * **Why:** Frame already sent; `activeRequest` holds correlation until `doReadComplete`
 * dispatches by `active.method` (parameter-driven, not a separate state per method).
 *
 * **How checked:** {@link assertRequestProcessing}; `activeRequest` defined.
 */
export function assertReading(ctx: ICBCommandChannelContext): void {
  assertRequestProcessing(ctx);
  if (ctx.activeRequest === undefined) {
    throw new Error(`${tag("Reading")}: active request must be set`);
  }
}

/**
 * **CommandClosing** leaf — CANCEL_ME or parent `close()`; session ending.
 *
 * **Why:** `closed` true while transport may still drain; enrolled flag may still be true
 * until finalize runs in `onEntry`.
 *
 * **How checked:** {@link assertCommandTransport}, `closed === true`.
 */
export function assertCommandClosing(ctx: ICBCommandChannelContext): void {
  assertCommandTransport(ctx);
  if (!ctx.closed) {
    throw new Error(`${tag("CommandClosing")}: closed must be true`);
  }
}

/**
 * **CommandTerminal** composite — channel closed from the client's perspective.
 *
 * **How checked:** `closed === true`.
 */
export function assertCommandTerminal(ctx: ICBCommandChannelContext): void {
  if (!ctx.closed) {
    throw new Error(`${tag("CommandTerminal")}: closed must be true`);
  }
}

/**
 * **CommandDetaching** leaf — interrupt posted; waiting for reader/writer ack.
 *
 * **How checked:** {@link assertCommandTerminal}.
 */
export function assertCommandDetaching(ctx: ICBCommandChannelContext): void {
  assertCommandTerminal(ctx);
}

/**
 * **CommandDetaching** after interrupt dispatch — TCP children cleared from context.
 *
 * **How checked:** {@link assertCommandDetaching}; `children === undefined`.
 */
export function assertCommandDetachingAfterInterrupt(ctx: ICBCommandChannelContext): void {
  assertCommandDetaching(ctx);
  if (ctx.children !== undefined) {
    throw new Error(`${tag("CommandDetaching")}: tcp children must be cleared after interrupt`);
  }
}

/**
 * **CommandClosed** leaf — graceful terminal; resources released.
 *
 * **How checked:** {@link assertCommandTerminal}; no children; no `brokenReason`.
 */
export function assertCommandClosed(ctx: ICBCommandChannelContext): void {
  assertCommandTerminal(ctx);
  if (ctx.children !== undefined) {
    throw new Error(`${tag("CommandClosed")}: tcp children must be disarmed`);
  }
  if (ctx.brokenReason !== undefined) {
    throw new Error(`${tag("CommandClosed")}: brokenReason must be unset`);
  }
}

/**
 * **CommandBroken** leaf — abnormal terminal.
 *
 * **How checked:** {@link assertCommandTerminal}; non-empty `brokenReason`.
 */
export function assertCommandBroken(ctx: ICBCommandChannelContext): void {
  assertCommandTerminal(ctx);
  if (ctx.brokenReason === undefined || ctx.brokenReason.length === 0) {
    throw new Error(`${tag("CommandBroken")}: brokenReason must be set`);
  }
}
