/**
 * State invariants for the CBServer supervisor ({@link CBServerTop}).
 */
import type { ICBServerContext } from "./CBServerContext";

const tag = (state: string) => `invariant violation [${state}]`;

export function assertInitialized(ctx: ICBServerContext): void {
  if (ctx.serverMailbox === undefined) {
    throw new Error(`${tag("Initialized")}: serverMailbox must be set`);
  }
}

export function assertProcessDetached(ctx: ICBServerContext): void {
  assertInitialized(ctx);
  ctx.assertProcessDisarmed();
  if (ctx.killGraceTimer !== undefined) {
    throw new Error(`${tag("ProcessDetached")}: killGraceTimer must be cleared`);
  }
}

export function assertProcessDetaching(ctx: ICBServerContext): void {
  assertInitialized(ctx);
  if (ctx.processSubscription !== undefined || ctx.pid !== undefined) {
    throw new Error(`${tag("ProcessDetaching")}: process handle must be cleared`);
  }
  if (ctx.killGraceTimer !== undefined) {
    throw new Error(`${tag("ProcessDetaching")}: killGraceTimer must be cleared`);
  }
  if (ctx.detachTarget !== "stopped" && ctx.detachTarget !== "shuttingDown") {
    throw new Error(`${tag("ProcessDetaching")}: detachTarget must be stopped or shuttingDown`);
  }
}

export function assertProcessDetachingAfterInterrupt(ctx: ICBServerContext): void {
  assertProcessDetaching(ctx);
  if (ctx.children !== undefined) {
    throw new Error(`${tag("ProcessDetaching")}: log readers must be cleared after interrupt`);
  }
}

export function assertUninitialized(ctx: ICBServerContext): void {
  ctx.assertProcessDisarmed();
  if (ctx.killSignaled) {
    throw new Error(`${tag("Uninitialized")}: killSignaled must be false`);
  }
}

export function assertUninitializedInstance(ctx: ICBServerContext): void {
  assertUninitialized(ctx);
  if (ctx.serverMailbox !== undefined) {
    throw new Error(`${tag("Uninitialized")}: serverMailbox must not be set yet`);
  }
}

export function assertStopped(ctx: ICBServerContext): void {
  assertProcessDetached(ctx);
  ctx.assertIdle();
}

export function assertShuttingDown(ctx: ICBServerContext): void {
  assertProcessDetached(ctx);
  if (!ctx.shutdownRequested) {
    throw new Error(`${tag("ShuttingDown")}: shutdownRequested must be true`);
  }
  if (ctx.detachTarget !== "shuttingDown") {
    throw new Error(`${tag("ShuttingDown")}: detachTarget must be shuttingDown`);
  }
}

export function assertProcessObserving(ctx: ICBServerContext): void {
  assertInitialized(ctx);
  const hasPid = ctx.pid !== undefined;
  const hasSub = ctx.processSubscription !== undefined;
  if (hasPid !== hasSub) {
    throw new Error(`${tag("ProcessObserving")}: pid and processSubscription must both be set or both unset`);
  }
}

export function assertStarting(ctx: ICBServerContext): void {
  assertProcessObserving(ctx);
  if (ctx.killSignaled) {
    throw new Error(`${tag("Starting")}: killSignaled must be false`);
  }
}

export function assertSpawnPending(ctx: ICBServerContext): void {
  assertStarting(ctx);
  if (ctx.children !== undefined) {
    throw new Error(`${tag("SpawnPending")}: log readers must not exist yet`);
  }
  if (ctx.pid !== undefined || ctx.processSubscription !== undefined) {
    throw new Error(`${tag("SpawnPending")}: process handle must not exist yet`);
  }
}

export function assertSpawnArmed(ctx: ICBServerContext): void {
  assertStarting(ctx);
  ctx.assertSpawnArmed();
}

export function assertProcessActive(ctx: ICBServerContext): void {
  assertProcessObserving(ctx);
  ctx.assertSpawnArmed();
}

export function assertRunning(ctx: ICBServerContext): void {
  assertProcessActive(ctx);
  if (ctx.killSignaled) {
    throw new Error(`${tag("Running")}: killSignaled must be false`);
  }
  if (ctx.serverMailbox === undefined) {
    throw new Error(`${tag("Running")}: server mailbox must be set`);
  }
}

export function assertStopping(ctx: ICBServerContext): void {
  assertProcessActive(ctx);
}
