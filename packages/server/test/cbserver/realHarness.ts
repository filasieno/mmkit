/**
 * Shared harness for real-cbserver integration tests.
 *
 * Graceful shutdown per manual (`Server-Interface.typ` § CANCEL_ME):
 * 1. `connection.close()` → command channel CANCEL_ME → notification channel CANCEL_ME → ConnectionClosed
 * 2. `server.stop()` → close each connection (children first) → SIGTERM → ProcessDetaching → Stopped
 */
/// <reference types="node" />
import { execSync } from "node:child_process";
import * as os from "node:os";
import { createServer } from "node:net";
import { expect } from "chai";
import * as ihsm from "ihsm/testing";
import { CBServerTop, Uninitialized } from "../../src/cbserver/actors/server/CBServerActor";
import { cbActorSpawnOptions } from "../../src/cbserver/shared/cbActorSpawnOptions";
import { CBServerConfig } from "../../src/cbserver/actors/server/settings/CBServerSettings";
import { DEFAULT_CB_TCP_CONNECT_MS } from "../../src/cbserver/shared/CBTcpOptions";
import { CBServerContext } from "../../src/cbserver/actors/server/CBServerContext";
import type { CBAnswer, ICBConnection } from "../../src/cbserver/shared/CBServerDefs";
import { CBServerPort } from "../../src/cbserver/actors/server/CBServerPort";
import { cbTrace, cbTraceAnswer } from "../../src/cbserver/shared/cbTrace";
import { currentPhasePath, formatLiveServersSnapshot, hangLog, popPhase, pushPhase, resetPhases, } from "./hangGuard";

function realTestActorOptions(): ihsm.ActorOptions {
  return cbActorSpawnOptions({ initialize: false });
}

export function resolveRealCbserverExecutable(): string | undefined {
  const fromEnv = process.env.MMKIT_REAL_CBSERVER_BIN?.trim();
  if (fromEnv !== undefined && fromEnv !== "") {
    return fromEnv;
  }
  try {
    const onPath = execSync("command -v cbserver", { encoding: "utf8" }).trim();
    if (onPath !== "") {
      return onPath;
    }
  } catch {
    // not in nix develop shell
  }
  return undefined;
}

export const cbserverBin = resolveRealCbserverExecutable();
export const describeReal = cbserverBin === undefined ? describe.skip : describe;

export function raceTimeout<T>(work: Promise<T>, label: string, ms: number): Promise<T> {
  pushPhase(`${label}≤${ms}ms`);
  const started = Date.now();
  hangLog("wait:start", { label, ms, path: currentPhasePath() });

  let timer: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => { timer = setTimeout(() => { const elapsed = Date.now() - started; hangLog("wait:timeout", { label, ms, elapsed, path: currentPhasePath(), liveServers: formatLiveServersSnapshot(liveServers), }); reject( new Error( `timeout:${label} after ${ms}ms (elapsed=${elapsed}ms, phase=${currentPhasePath()}, servers=${JSON.stringify(formatLiveServersSnapshot(liveServers))})`, ), ); }, ms); });

  return Promise.race([work, timeoutPromise]).finally(() => { if (timer !== undefined) { clearTimeout(timer); } popPhase(`${label}≤${ms}ms`); hangLog("wait:end", { label, ms, elapsed: Date.now() - started }); });
}

/** Real-cbserver tests: set MMKIT_REAL_FAST=1 for 5s-per-test budgets (one-by-one runner). */
export const REAL_TEST_FAST = process.env.MMKIT_REAL_FAST === "1";

/** Shorter socket idle timeout for real tests (fail before mocha suite timeout). */
export const REAL_TEST_SOCKET_MS = REAL_TEST_FAST ? 3_000 : 6_000;

/** Per-step ceilings — every async test path must use one of these (no bare awaits). */
export const MS = REAL_TEST_FAST
  ? {
      sync: 1_000,
      init: 1_500,
      start: 3_500,
      boot: 4_500,
      conn: 3_000,
      cmd: 4_000,
      step: 4_000,
      identity: 2_000,
      close: 1_500,
      stop: 3_000,
      teardown: 2_000,
      session: 4_500,
      port: 2_000,
      forceKill: 500,
    }
  : {
      sync: 800,
      init: 2_000,
      start: 15_000,
      boot: 25_000,
      conn: 5_000,
      cmd: 15_000,
      step: 15_000,
      identity: 3_000,
      close: 8_000,
      stop: 6_000,
      teardown: 8_000,
      session: 60_000,
      port: 3_000,
      forceKill: 500,
    };

export const PER_TEST_TIMEOUT_MS = REAL_TEST_FAST
  ? Number(process.env.MMKIT_REAL_PER_TEST_MS ?? 5_000)
  : 90_000;

/** Generic timed wrapper for non-command async work (getters, session bodies, fs, …). */
export async function runTimed<T>( label: string, work: () => Promise<T>, ms: number = MS.step ): Promise<T> {
  cbTrace(`test:timed:start:${label}`);
  const result = await raceTimeout(work(), label, ms);
  cbTrace(`test:timed:done:${label}`);
  return result;
}

export type RunningServer = {
  actor: ReturnType<typeof ihsm.makeTestActor<typeof CBServerTop>>;
  ctx: CBServerContext;
  port: CBServerPort;
};

export type RealSession = {
  server: RunningServer;
  connection: ICBConnection;
};

export const liveServers: RunningServer[] = [];
let dbCounter = 0;

async function pickFreePort(): Promise<number> {
  return raceTimeout( new Promise((resolve, reject) => { const server = createServer(); server.once("error", reject); server.listen(0, "127.0.0.1", () => { const address = server.address(); if (address === null || typeof address === "string") { server.close(() => reject(new Error("failed to bind ephemeral port"))); return; } const port = address.port; server.close((err) => (err ? reject(err) : resolve(port))); }); }), "pick-free-port", MS.port );
}

/** Matches {@link CBConnectionContext.enrollUserSuffix} — required for STOP_SERVER privilege. */
export function enrollUserSuffix(userName = os.userInfo().username): string {
  return `${userName}@${os.hostname()}_${os.arch()}_${os.platform().replace(/\s/g, "")}`;
}

export async function makeConfig(label: string): Promise<CBServerConfig> {
  const port = await pickFreePort();
  // Match cbserver `user()` on WSL (often "unknown") so LPI_CALL sameUser checks pass.
  const clientUserName = "unknown";
  // `-v on` enables view-maintenance rule generation for the dual-channel NOTIFICATION_REQUEST path (`vm_<id>` query structs).
  return new CBServerConfig( { launch: { executablePath: cbserverBin! }, network: { port, portProbeMaxAttempts: 30, portProbeIntervalMs: 250, portProbeConnectTimeoutMs: 400 }, paths: { dataDir: "", updateMode: "nonpersistent", newDatabasePath: `/tmp/mmkit-cb-real-${label}-${++dbCounter}`, resetOnStart: true }, runtime: { adminUser: enrollUserSuffix(clientUserName), viewsMaintenance: "on" }, mmkit: { killGraceMs: 2_000, clientUserName } } );
}

export async function syncServer(server: RunningServer, label = "sync"): Promise<void> {
  await raceTimeout(server.actor.hsm.sync(), label, MS.sync);
}

/** Poll actor sync until supervisor reaches `state` (async stop/detach path). */
export async function waitForServerState( server: RunningServer, state: string, label: string, ms: number = MS.stop ): Promise<void> {
  pushPhase(`waitForState:${state}(${label})`);
  const deadline = Date.now() + ms;
  try {
    while (server.actor.hsm.currentStateName !== state) {
      if (Date.now() > deadline) {
        hangLog("waitForState:timeout", { label, expected: state, actual: server.actor.hsm.currentStateName, lastExit: server.ctx.lastExit, path: currentPhasePath(), });
        const exitHint =
          server.ctx.lastExit?.errorMessage !== undefined
            ? `; lastExit=${server.ctx.lastExit.errorMessage}`
            : server.ctx.lastExit !== undefined
              ? `; lastExit code=${server.ctx.lastExit.code} signal=${server.ctx.lastExit.signal}`
              : "";
        throw new Error( `timeout:${label}: expected ${state}, got ${server.actor.hsm.currentStateName}${exitHint}` );
      }
      await syncServer(server, `${label}-poll`);
    }
  } finally {
    popPhase(`waitForState:${state}(${label})`);
  }
}

export async function bootRunning(config: CBServerConfig): Promise<RunningServer> {
  return raceTimeout( (async () => { const port = new CBServerPort(); const ctx = new CBServerContext(config); const actor = ihsm.makeTestActor(CBServerTop, ctx, port, realTestActorOptions()); actor.hsm.restore(Uninitialized, ctx); await raceTimeout(actor.call.initialize(), "initialize", MS.init); await syncServer({ actor, ctx, port }, "init-sync"); expect(actor.hsm.currentStateName).to.equal("Stopped"); actor.notify.start(); await waitForServerState({ actor, ctx, port }, "Running", "start", MS.start); expect(ctx.children?.stdoutLogReader).to.not.equal(undefined); expect(ctx.children?.stderrLogReader).to.not.equal(undefined); const server = { actor, ctx, port }; liveServers.push(server); return server; })(), "boot-running", MS.boot );
}

export async function openConnection(server: RunningServer): Promise<ICBConnection> {
  const connection = await raceTimeout( server.actor.call.createConnection({ connectTimeoutMs: DEFAULT_CB_TCP_CONNECT_MS, socketTimeoutMs: REAL_TEST_SOCKET_MS, }), "create-connection", MS.conn );
  await syncServer(server, "connection-sync");
  expect(server.ctx.connections.size).to.be.greaterThan(0);
  return connection;
}

export async function runCommand( server: RunningServer, connection: ICBConnection, label: string, work: () => Promise<CBAnswer> ): Promise<CBAnswer> {
  cbTrace(`test:cmd:start:${label}`);
  const answer = await raceTimeout(work(), label, MS.cmd);
  await syncServer(server, `${label}-sync`);
  cbTraceAnswer(`test:cmd:done:${label}`, answer);
  expect(answer.ok, `${label} completion=${answer.completion} term=${answer.term}`).to.equal(true);
  return answer;
}

/** Poll until supervisor connection registry reaches the expected size. */
export async function waitForRegistrySize( server: RunningServer, label: string, expected: number, ms = MS.close ): Promise<void> {
  pushPhase(`waitForRegistry:${expected}(${label})`);
  const deadline = Date.now() + ms;
  try {
    while (server.ctx.connections.size !== expected) {
      if (Date.now() > deadline) {
        hangLog("waitForRegistry:timeout", { label, expected, actual: server.ctx.connections.size, path: currentPhasePath(), });
        throw new Error( `timeout:${label}: connections.size=${server.ctx.connections.size}, expected=${expected}` );
      }
      await syncServer(server, `${label}-registry-poll`);
    }
  } finally {
    popPhase(`waitForRegistry:${expected}(${label})`);
  }
}

/** Poll until supervisor connection registry is empty (onClose after CANCEL_ME). */
export async function waitForEmptyRegistry( server: RunningServer, label: string, ms = MS.close ): Promise<void> {
  await waitForRegistrySize(server, label, 0, ms);
}

/** Manual § CANCEL_ME — disconnect client before TCP teardown. */
export async function gracefulCloseConnection(server: RunningServer, connection: ICBConnection): Promise<void> {
  const openBefore = server.ctx.connections.size;
  expect(openBefore).to.be.greaterThan(0);
  try {
    await raceTimeout( (async () => { await raceTimeout(connection.close(), "close", MS.close); await waitForRegistrySize(server, "close-registry", openBefore - 1, MS.close); })(), "graceful-close-connection", MS.close + 250 );
  } catch (err) {
    cbTrace(`test:teardown:graceful-close-failed:${String(err)}`);
    for (const child of server.ctx.connections.values()) {
      try {
        child.notify.close();
      } catch {
        // channel may already be broken
      }
    }
    await waitForRegistrySize(server, "force-close-registry", 0, MS.close).catch(() => undefined);
  }
}

async function killServerProcess(server: RunningServer): Promise<void> {
  for (const child of server.ctx.connections.values()) {
    try {
      child.notify.close();
    } catch {
      // ignore broken channels
    }
  }
  const pid = server.ctx.pid;
  if (pid !== undefined) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // already gone
    }
  }
  await syncServer(server, "kill-server-sync").catch(() => undefined);
}

async function teardownServer(server: RunningServer): Promise<void> {
  const idx = liveServers.indexOf(server);
  if (idx >= 0) {
    liveServers.splice(idx, 1);
  }

  try {
    await raceTimeout( (async () => { if (server.actor.hsm.currentStateName === "Running") { server.actor.notify.stop(); await waitForServerState(server, "Stopped", "teardown-stop"); } expect(server.ctx.pid).to.equal(undefined); await waitForEmptyRegistry(server, "teardown-registry"); })(), "teardown-server", MS.teardown );
  } catch (err) {
    cbTrace(`test:teardown:graceful-stop-failed:${String(err)}`);
    await killServerProcess(server);
  }
}

export async function gracefulStopServer(server: RunningServer): Promise<void> {
  await teardownServer(server);
}

export async function forceStopRunning(server: RunningServer): Promise<void> {
  await raceTimeout( (async () => { await teardownServer(server); })(), "force-stop-running", MS.teardown + MS.forceKill ).catch(async () => { await killServerProcess(server); const idx = liveServers.indexOf(server); if (idx >= 0) { liveServers.splice(idx, 1); } });
}

/**
 * Boot cbserver, open one enrolled connection, run test body, then always
 * CANCEL_ME-close the connection and stop the server (graceful path).
 */
export async function withRealSession( label: string, work: (session: RealSession) => Promise<void> ): Promise<void> {
  pushPhase(`withRealSession:${label}`);
  try {
    const server = await bootRunning(await makeConfig(label));
    let connection: ICBConnection | undefined;
    try {
      connection = await openConnection(server);
      await runTimed(`session-body:${label}`, () => work({ server, connection: connection! }), MS.session);
    } finally {
      if (connection !== undefined) {
        await gracefulCloseConnection(server, connection);
      }
      await teardownServer(server);
    }
  } finally {
    popPhase(`withRealSession:${label}`);
  }
}

/**
 * Boot cbserver, run test body, then stop the server. Use when the test manages
 * its own connections (lifecycle suites).
 */
export async function withRealServer( label: string, work: (server: RunningServer) => Promise<void> ): Promise<void> {
  pushPhase(`withRealServer:${label}`);
  try {
    const server = await bootRunning(await makeConfig(label));
    try {
      await runTimed(`server-body:${label}`, () => work(server), MS.session);
    } finally {
      await teardownServer(server);
    }
  } finally {
    popPhase(`withRealServer:${label}`);
  }
}

let currentTestTitle = "";
let testStartedAt = 0;
let heartbeatTimer: NodeJS.Timeout | undefined;
let watchdogTimer: NodeJS.Timeout | undefined;

function clearTestTimers(): void {
  if (heartbeatTimer !== undefined) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = undefined;
  }
  if (watchdogTimer !== undefined) {
    clearTimeout(watchdogTimer);
    watchdogTimer = undefined;
  }
}

async function forceStopAllLiveServers(): Promise<void> {
  while (liveServers.length > 0) {
    await forceStopRunning(liveServers[0]!);
  }
}

/**
 * Per-test heartbeat + watchdog + teardown. Real suites must call this once.
 *
 * - Heartbeat logs current phase every 5s (override with `MMKIT_TEST_HEARTBEAT_MS`).
 * - Watchdog at 85% of mocha per-test timeout force-kills live servers and logs phase.
 * - afterEach always drains `liveServers` so a failed test cannot leak cbserver PIDs.
 */
export function installRealTestGuards(suite: Mocha.Suite): void {
  suite.beforeEach(function () { clearTestTimers(); resetPhases(); currentTestTitle = this.currentTest?.fullTitle() ?? "(unknown)"; testStartedAt = Date.now(); hangLog("test:start", { title: currentTestTitle }); const heartbeatMs = Number(process.env.MMKIT_TEST_HEARTBEAT_MS ?? 5_000); heartbeatTimer = setInterval(() => { hangLog("test:heartbeat", { title: currentTestTitle, elapsedMs: Date.now() - testStartedAt, phase: currentPhasePath(), liveServers: formatLiveServersSnapshot(liveServers), }); }, heartbeatMs); const testTimeout = typeof this.timeout === "function" && this.timeout() > 0 ? this.timeout() : PER_TEST_TIMEOUT_MS; const watchdogMs = Math.max(MS.teardown, Math.floor(testTimeout * 0.85)); watchdogTimer = setTimeout(() => { hangLog("test:watchdog", { title: currentTestTitle, elapsedMs: Date.now() - testStartedAt, watchdogMs, phase: currentPhasePath(), liveServers: formatLiveServersSnapshot(liveServers), }); void forceStopAllLiveServers().catch((err) => { hangLog("test:watchdog:teardown-failed", { error: String(err) }); }); }, watchdogMs); });

  suite.afterEach(async function () { clearTestTimers(); hangLog("test:end", { title: currentTestTitle, elapsedMs: Date.now() - testStartedAt, phase: currentPhasePath(), }); resetPhases(); this.timeout(MS.teardown + 5_000); await forceStopAllLiveServers(); });
}

/** @deprecated Use {@link installRealTestGuards} */
export const installRealAfterEach = installRealTestGuards;
