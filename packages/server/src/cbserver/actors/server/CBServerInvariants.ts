/**
 * Hierarchical state invariants for the {@link CBServerTop} supervisor actor.
 *
 * ## Composition rule
 *
 * Each leaf state's `_checkInvariant()` delegates to exactly one `assert*` function here.
 * Deeper assertions **call** shallower ones first, so every predicate inherited from a
 * parent composite still holds in the child. If `assertRunning` passes, then
 * `assertProcessActive`, `assertProcessObserving`, and `assertInitialized` have already
 * been verified transitively.
 *
 * ## Handler discipline
 *
 * Every notification handler, service call, `onEntry`, and `onExit` in the actor should
 * invoke `_checkInvariant()` before mutating context. Violations throw `Error` with a
 * message tagged `invariant violation [<StateName>]`, which pinpoints the leaf state whose
 * context bag no longer matches its phase.
 *
 * @module cbserver/actors/server/CBServerInvariants
 * @see {@link CBServerActor} state classes that call these assertions
 */
import type { ICBServerContext } from "./CBServerConfig";

const tag = (state: string) => `invariant violation [${state}]`;

/** Process subscription and pid must both be set after spawn. */
export function assertSpawnHandleArmed(ctx: ICBServerContext): void {
  if (ctx.processSubscription === undefined || ctx.pid === undefined) {
    throw new Error("invariant violation: process subscription must be armed");
  }
}

/** Spawn handle armed and stdout/stderr log readers registered. */
export function assertLogReadersArmed(ctx: ICBServerContext): void {
  assertSpawnHandleArmed(ctx);
  if (ctx.children === undefined) {
    throw new Error("invariant violation: log readers must be armed while process is active");
  }
}

/** No live process handle or log-reader children. */
export function assertProcessDisarmed(ctx: ICBServerContext): void {
  if (ctx.processSubscription !== undefined || ctx.pid !== undefined) {
    throw new Error("invariant violation: process subscription must be disarmed");
  }
  if (ctx.children !== undefined) {
    throw new Error("invariant violation: log readers must be disarmed");
  }
}

/**
 * **Initialized** composite — supervisor has completed `initialize()` and owns a mailbox.
 *
 * **Why:** Internal `do*` notifications, connection spawn, and log-reader arming all need
 * `ctx.serverMailbox` to schedule work back into this actor. Before initialization the
 * machine cannot accept `start()`, spawn children, or register connections.
 *
 * **How checked:** `ctx.serverMailbox !== undefined`.
 *
 * **Inherited by:** `ProcessDetached`, `ProcessObserving`, `ProcessDetaching`, and all
 * descendants except `Uninitialized`.
 *
 * @param ctx - Supervisor context bag
 * @throws When `serverMailbox` is still undefined
 */
export function assertInitialized(ctx: ICBServerContext): void {
  if (ctx.serverMailbox === undefined) {
    throw new Error(`${tag("Initialized")}: serverMailbox must be set`);
  }
}

/**
 * **ProcessDetached** composite — no live cbserver OS process is attached.
 *
 * **Why:** In detached phases the supervisor only manages idle/shutdown bookkeeping.
 * A live `pid`, process subscription, log-reader children, or a pending kill timer would
 * mean teardown did not finish or spawn leaked into a detached state.
 *
 * **How checked:** Calls {@link assertInitialized}, then {@link assertProcessDisarmed()}
 * (no pid, subscription, or log-reader children) and `killGraceTimer === undefined`.
 *
 * **Inherited by:** `Stopped`, `ShuttingDown`.
 */
export function assertProcessDetached(ctx: ICBServerContext): void {
  assertInitialized(ctx);
  assertProcessDisarmed(ctx);
  if (ctx.killGraceTimer !== undefined) {
    throw new Error(`${tag("ProcessDetached")}: killGraceTimer must be cleared`);
  }
}

/**
 * **ProcessDetaching** — asynchronous teardown of log-reader children after process exit.
 *
 * **Why:** The OS process is already gone, but stdout/stderr log readers may still be
 * flushing buffers. The terminal leaf (`Stopped` vs `ShuttingDown`) is decided from
 * `shutdownRequested` once `pendingLogReaderInterrupts` reaches zero.
 *
 * **How checked:** Process handle cleared; no kill timer.
 *
 * **Stricter variant:** {@link assertProcessDetachingAfterInterrupt} also requires log
 * reader children to be cleared after `doDispatchInterrupt`.
 */
export function assertProcessDetaching(ctx: ICBServerContext): void {
  assertInitialized(ctx);
  if (ctx.processSubscription !== undefined || ctx.pid !== undefined) {
    throw new Error(`${tag("ProcessDetaching")}: process handle must be cleared`);
  }
  if (ctx.killGraceTimer !== undefined) {
    throw new Error(`${tag("ProcessDetaching")}: killGraceTimer must be cleared`);
  }
}

/**
 * **ProcessDetaching** after `doDispatchInterrupt` — children must be disarmed.
 *
 * **Why:** Once interrupt is posted to log readers, the supervisor context must not
 * still hold reader actor handles; forwarding stdio to cleared children would be a use-
 * after-teardown bug.
 *
 * **How checked:** {@link assertProcessDetaching} plus `ctx.children === undefined`.
 */
export function assertProcessDetachingAfterInterrupt(ctx: ICBServerContext): void {
  assertProcessDetaching(ctx);
  if (ctx.children !== undefined) {
    throw new Error(`${tag("ProcessDetaching")}: log readers must be cleared after interrupt`);
  }
}

/**
 * **Uninitialized** composite — actor constructed but `initialize()` not yet called.
 *
 * **Why:** No process resources may exist before the port wires the actor mailbox.
 *
 * **How checked:** {@link assertProcessDisarmed}.
 */
export function assertUninitialized(ctx: ICBServerContext): void {
  assertProcessDisarmed(ctx);
}

/**
 * **Uninitialized** leaf — strict pre-`initialize()` instance.
 *
 * **Why:** `serverMailbox` must not be set until `initialize()` assigns it from the port;
 * otherwise we could accept public API calls without a valid actor reference.
 *
 * **How checked:** {@link assertUninitialized} plus `serverMailbox === undefined`.
 */
export function assertUninitializedInstance(ctx: ICBServerContext): void {
  assertUninitialized(ctx);
  if (ctx.serverMailbox !== undefined) {
    throw new Error(`${tag("Uninitialized")}: serverMailbox must not be set yet`);
  }
}

/**
 * **Stopped** leaf — idle, no process, ready to `start()` again.
 *
 * **Why:** Operators expect `Stopped` to mean a clean slate: no connections, no process
 * baggage. Shares the detached shape with its parent `ProcessDetached`.
 *
 * **How checked:** {@link assertProcessDetached}.
 */
export function assertStopped(ctx: ICBServerContext): void {
  assertProcessDetached(ctx);
}

/**
 * **ShuttingDown** leaf — process detached after an explicit shutdown request.
 *
 * **Why:** Distinguishes operator-initiated shutdown (`shutdownRequested`) from a mere
 * stop-and-restart cycle: this leaf is terminal (no `start()`).
 *
 * **How checked:** {@link assertProcessDetached}, `shutdownRequested === true`.
 */
export function assertShuttingDown(ctx: ICBServerContext): void {
  assertProcessDetached(ctx);
  if (!ctx.shutdownRequested) {
    throw new Error(`${tag("ShuttingDown")}: shutdownRequested must be true`);
  }
}

/**
 * **ProcessObserving** composite — supervisor may receive process lifecycle events.
 *
 * **Why:** `pid` and `processSubscription` are allocated and disposed as a pair when
 * spawning or killing the cbserver child. A mismatch (pid without subscription or the
 * reverse) indicates a half-finished spawn or a leak after `disposeProcess()`.
 *
 * **How checked:** {@link assertInitialized}; `pid` and `processSubscription` are both
 * defined or both undefined.
 *
 * **Inherited by:** `Starting`, `ProcessActive`, and all their descendants.
 */
export function assertProcessObserving(ctx: ICBServerContext): void {
  assertInitialized(ctx);
  const hasPid: boolean = ctx.pid !== undefined;
  const hasSub: boolean = ctx.processSubscription !== undefined;
  if (hasPid !== hasSub) {
    throw new Error(`${tag("ProcessObserving")}: pid and processSubscription must both be set or both unset`);
  }
}

/**
 * **Starting** composite — boot sequence in progress.
 *
 * **Why:** Process observation invariants apply because spawn may have assigned a pid.
 * Stop choreography (SIGTERM) lives in the `Terminating` state, not a flag, so there is
 * nothing extra to assert here beyond process observation.
 *
 * **Inherited by:** `SpawnPending`, `SpawnArmed`, `TcpConnecting`.
 */
export function assertStarting(ctx: ICBServerContext): void {
  assertProcessObserving(ctx);
}

/**
 * **SpawnPending** leaf — `doStart()` is spawning the cbserver OS process.
 *
 * **Why:** No log readers and no process handle yet: spawn is in flight. Log readers are
 * armed only after `pid` is known (`SpawnArmed`). Early stdio events must not be forwarded
 * to non-existent children.
 *
 * **How checked:** {@link assertStarting}; `children === undefined`; no pid/subscription.
 */
export function assertSpawnPending(ctx: ICBServerContext): void {
  assertStarting(ctx);
  if (ctx.children !== undefined) {
    throw new Error(`${tag("SpawnPending")}: log readers must not exist yet`);
  }
  if (ctx.pid !== undefined || ctx.processSubscription !== undefined) {
    throw new Error(`${tag("SpawnPending")}: process handle must not exist yet`);
  }
}

/**
 * **SpawnArmed** leaf — process spawned; log-reader arm runs in `doBeginStartup`.
 *
 * **Why:** {@link assertSpawnHandleArmed} verifies pid and subscription before startup choreography.
 * Log readers are armed in `doBeginStartup` (stdio may arrive briefly before that completes).
 *
 * **How checked:** {@link assertStarting} then {@link assertSpawnHandleArmed}.
 */
export function assertSpawnArmed(ctx: ICBServerContext): void {
  assertStarting(ctx);
  assertSpawnHandleArmed(ctx);
}

/**
 * **TcpConnecting** leaf — polling TCP listen readiness before `Running`.
 *
 * **Why:** Log readers are already armed; the supervisor retries single connect probes
 * until the cbserver accepts TCP or the attempt budget is exhausted.
 *
 * **How checked:** {@link assertStarting} then {@link assertLogReadersArmed}.
 */
export function assertTcpConnecting(ctx: ICBServerContext): void {
  assertStarting(ctx);
  assertLogReadersArmed(ctx);
}

/**
 * **ProcessActive** composite — process is live with log readers armed (spawn complete).
 *
 * **Why:** Accepts `createConnection`, process exit handling, and stop transitions.
 * Shared by `Running` and the stop phases; the kill grace timer may be set in
 * `Terminating`, so this assert covers only the armed-spawn shape.
 *
 * **How checked:** {@link assertProcessObserving} and {@link assertLogReadersArmed}.
 *
 * **Inherited by:** `Running`, `Stopping`, `Terminating`.
 */
export function assertProcessActive(ctx: ICBServerContext): void {
  assertProcessObserving(ctx);
  assertLogReadersArmed(ctx);
}

/**
 * **Running** leaf — cbserver is up; accepts new TCP connections.
 *
 * **Why:** A live, un-signalled process: SIGTERM is sent only on entering `Terminating`,
 * so being in `Running` already guarantees stop has not begun. Mailbox must remain set
 * for connection child spawn.
 *
 * **How checked:** {@link assertProcessActive}, `serverMailbox` defined.
 */
export function assertRunning(ctx: ICBServerContext): void {
  assertProcessActive(ctx);
  if (ctx.serverMailbox === undefined) {
    throw new Error(`${tag("Running")}: server mailbox must be set`);
  }
}

/**
 * **Stopping** leaf — graceful stop phase 1: closing live TCP connections.
 *
 * **Why:** Process is still live with log readers armed, so it shares the active-process
 * shape with `Running`. SIGTERM has not been sent yet (that is `Terminating`).
 *
 * **How checked:** {@link assertProcessActive} only.
 */
export function assertStopping(ctx: ICBServerContext): void {
  assertProcessActive(ctx);
}

/**
 * **Terminating** leaf — graceful stop phase 2: SIGTERM sent, kill grace armed.
 *
 * **Why:** Process is still live (awaiting exit) with log readers armed, so it shares the
 * active-process shape. The kill timer may be set; process exit drives `doCompleteStop`.
 *
 * **How checked:** {@link assertProcessActive} only.
 */
export function assertTerminating(ctx: ICBServerContext): void {
  assertProcessActive(ctx);
}
