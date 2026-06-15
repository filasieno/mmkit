/**
 * Hierarchical state invariants for the {@link CBConnectionTop} connection orchestrator.
 *
 * The orchestrator owns two channel child actors (command + notification) and bridges
 * client-facing `dispatch*` calls to them when both channels are enrolled.
 *
 * ## Composition
 *
 * `assertConnectionClosed` / `assertConnectionBroken` extend `assertConnectionTerminal`.
 * `assertConnecting` reuses `assertConnectionUninitialized` because bootstrap has the same
 * channel-absent shape as construction.
 *
 * @module cbserver/actors/connection/CBServerConnectionInvariants
 */
import type { ICBConnectionContext } from "./CBServerConnectionContext";

const tag = (state: string) => `invariant violation [${state}]`;

/**
 * **ConnectionUninitialized** leaf — connection id assigned, channels not spawned.
 *
 * **Why:** The orchestrator is constructed with a `connectionId` but TCP channel children
 * are created only during `initialize()`. `closed` must be false and channel handles unset.
 *
 * **How checked:** `!closed`, non-empty `connectionId`, no `commandChannel` / `notificationChannel`.
 */
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

/**
 * **Connecting** leaf — channel spawn and ENROLL handshake in progress.
 *
 * **Why:** Same context shape as uninitialized (channels may exist but enrollment not
 * complete); reuses uninitialized predicates until both channels report enrolled.
 *
 * **How checked:** Delegates to {@link assertConnectionUninitialized}.
 */
export function assertConnecting(ctx: ICBConnectionContext): void {
  assertConnectionUninitialized(ctx);
}

/**
 * **ConnectionIdle** leaf — both channels spawned, enrolled, ready for IPC bridge.
 *
 * **Why:** `dispatchCommand` / `dispatchGetNotificationMessage` require live, enrolled
 * channels. `commandCtx.enrolled` and `notificationCtx.enrolled` mirror the Java client's
 * session state. `closed` must still be false.
 *
 * **How checked:** Both channel actors defined; both context snapshots show `enrolled`.
 *
 * @remarks `pendingCommand` / `pendingNotification` are waiter handles, not part of this
 * invariant — a future `ConnectionAwaitingCommand` state could move that into asserts.
 */
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

/**
 * **ConnectionClosing** leaf — `close()` taken; waiting for channel teardown.
 *
 * **Why:** `closed === true` gates new client work at ConnectionBase (guard throws).
 * Channels may still be winding down.
 *
 * **How checked:** `ctx.closed === true`.
 */
export function assertConnectionClosing(ctx: ICBConnectionContext): void {
  if (!ctx.closed) {
    throw new Error(`${tag("ConnectionClosing")}: closed must be true`);
  }
}

/**
 * **ConnectionTerminal** composite — connection will not accept new work.
 *
 * **Why:** Parent of Closed/Broken; only requires the closed flag so shared terminal
 * handlers can run before we know graceful vs broken outcome.
 *
 * **How checked:** `ctx.closed === true`.
 */
export function assertConnectionTerminal(ctx: ICBConnectionContext): void {
  if (!ctx.closed) {
    throw new Error(`${tag("ConnectionTerminal")}: closed must be true`);
  }
}

/**
 * **ConnectionClosed** leaf — graceful shutdown complete.
 *
 * **Why:** No `brokenReason`; both channel actors finished close so the orchestrator can
 * notify the supervisor and release resources.
 *
 * **How checked:** {@link assertConnectionTerminal}; no `brokenReason`; `bothChannelsClosed()`.
 */
export function assertConnectionClosed(ctx: ICBConnectionContext): void {
  assertConnectionTerminal(ctx);
  if (ctx.brokenReason !== undefined) {
    throw new Error(`${tag("ConnectionClosed")}: brokenReason must be unset`);
  }
  if (!ctx.bothChannelsClosed()) {
    throw new Error(`${tag("ConnectionClosed")}: both channels must be closed`);
  }
}

/**
 * **ConnectionBroken** leaf — abnormal termination (socket error, protocol fault, etc.).
 *
 * **Why:** `brokenReason` documents why the connection failed for clients and logs;
 * must be non-empty to distinguish from graceful close.
 *
 * **How checked:** {@link assertConnectionTerminal}; `brokenReason` non-empty string.
 */
export function assertConnectionBroken(ctx: ICBConnectionContext): void {
  assertConnectionTerminal(ctx);
  if (ctx.brokenReason === undefined || ctx.brokenReason.length === 0) {
    throw new Error(`${tag("ConnectionBroken")}: brokenReason must be set`);
  }
}
