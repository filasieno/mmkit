/**
 * Mock-port harness — same API as realHarness; exercises identical actor state machines.
 */
/// <reference types="mocha" />
import { expect } from "chai";
import * as ihsm from "ihsm/testing";
import { CBServerTop, Uninitialized } from "../../src/cbserver/actors/server/CBServerActor";
import { cbActorSpawnOptions } from "../../src/cbserver/shared/cbActorSpawnOptions";
import { CBServerConfig } from "../../src/cbserver/actors/server/settings/CBServerSettings";
import { DEFAULT_CB_TCP_CONNECT_MS } from "../../src/cbserver/shared/CBTcpOptions";
import { CBServerContext } from "../../src/cbserver/actors/server/CBServerContext";
import type { CBAnswer, CBConnectionActorHandle } from "../../src/cbserver/shared/CBServerDefs";
import { closeConnection } from "../../src/cbserver/actors/connection/connectionLifecycle";
import { cbTrace, cbTraceAnswer } from "../../src/cbserver/shared/cbTrace";
import type { RunningServer, TestSession } from "./harnessTypes";
import { makeMockPort, type MockCBServerPort } from "./mockPort";

export type { RunningServer, TestSession, RunCommand } from "./harnessTypes";

function mockTestActorOptions(): ihsm.ActorOptions {
  return cbActorSpawnOptions({ initialize: false });
}

export const MS = {
  sync: 800,
  init: 2_000,
  start: 5_000,
  boot: 8_000,
  conn: 3_000,
  cmd: 5_000,
  step: 5_000,
  identity: 2_000,
  close: 3_000,
  stop: 4_000,
  teardown: 4_000,
  session: 30_000,
  port: 1_000,
  forceKill: 500,
};

export const PER_TEST_TIMEOUT_MS = 30_000;

export function raceTimeout<T>(work: Promise<T>, label: string, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`timeout:${label} after ${ms}ms`));
    }, ms);
  });
  return Promise.race([work, timeoutPromise]).finally(() => {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  });
}

export async function runTimed<T>(
  label: string,
  work: () => Promise<T>,
  ms: number = MS.step,
): Promise<T> {
  cbTrace(`test:timed:start:${label}`);
  const result = await raceTimeout(work(), label, ms);
  cbTrace(`test:timed:done:${label}`);
  return result;
}

export type MockRunningServer = RunningServer & {
  port: ReturnType<typeof ihsm.makeTestPort<MockCBServerPort>>;
};

export async function makeConfig(label: string): Promise<CBServerConfig> {
  return new CBServerConfig({
    launch: { executablePath: "/mock/cbserver" },
    network: { port: 4001, portProbeMaxAttempts: 3, portProbeIntervalMs: 10, portProbeConnectTimeoutMs: 10 },
    paths: { dataDir: "", updateMode: "nonpersistent", newDatabasePath: `/tmp/mmkit-mock-${label}`, resetOnStart: true },
    runtime: { adminUser: "mock@localhost", viewsMaintenance: "on" },
    mmkit: { killGraceMs: 50, clientUserName: "unknown" },
  });
}

export async function syncServer(server: RunningServer, label = "sync"): Promise<void> {
  await raceTimeout(server.actor.hsm.sync(), label, MS.sync);
}

export async function waitForServerState(
  server: RunningServer,
  state: string,
  label: string,
  ms: number = MS.stop,
): Promise<void> {
  const deadline = Date.now() + ms;
  while (server.actor.hsm.currentStateName !== state) {
    if (Date.now() > deadline) {
      throw new Error(`timeout:${label}: expected ${state}, got ${server.actor.hsm.currentStateName}`);
    }
    await syncServer(server, `${label}-poll`);
  }
}

export async function bootRunning(config: CBServerConfig): Promise<MockRunningServer> {
  const port = makeMockPort();
  const ctx = new CBServerContext(config);
  const actor = ihsm.makeTestActor(CBServerTop, ctx, port, mockTestActorOptions());
  actor.hsm.restore(Uninitialized, ctx);
  const init = await raceTimeout(actor.call.initialize(), "initialize", MS.init);
  await raceTimeout(init.wait(), "initialize-wait", MS.init);
  await syncServer({ actor, ctx, port }, "init-sync");
  expect(actor.hsm.currentStateName).to.equal("Stopped");
  actor.notify.start();
  await waitForServerState({ actor, ctx, port }, "Running", "start", MS.start);
  const server: MockRunningServer = { actor, ctx, port };
  liveServers.push(server);
  return server;
}

export async function openConnection(server: RunningServer): Promise<CBConnectionActorHandle> {
  const connection = await raceTimeout(
    server.actor.call.createConnection({
      connectTimeoutMs: DEFAULT_CB_TCP_CONNECT_MS,
      socketTimeoutMs: 6_000,
    }),
    "create-connection",
    MS.conn,
  );
  await syncServer(server, "connection-sync");
  expect(server.ctx.connections.size).to.be.greaterThan(0);
  return connection;
}

export async function runCommand(
  server: RunningServer,
  connection: CBConnectionActorHandle,
  label: string,
  work: () => Promise<CBAnswer>,
): Promise<CBAnswer> {
  cbTrace(`test:cmd:start:${label}`);
  const answer = await raceTimeout(work(), label, MS.cmd);
  await syncServer(server, `${label}-sync`);
  cbTraceAnswer(`test:cmd:done:${label}`, answer);
  expect(answer.ok, `${label} completion=${answer.completion} term=${answer.term}`).to.equal(true);
  return answer;
}

export async function waitForRegistrySize(
  server: RunningServer,
  label: string,
  expected: number,
  ms = MS.close,
): Promise<void> {
  const deadline = Date.now() + ms;
  while (server.ctx.connections.size !== expected) {
    if (Date.now() > deadline) {
      throw new Error(`timeout:${label}: connections.size=${server.ctx.connections.size}, expected=${expected}`);
    }
    await syncServer(server, `${label}-registry-poll`);
  }
}

export async function waitForEmptyRegistry(server: RunningServer, label: string, ms = MS.close): Promise<void> {
  await waitForRegistrySize(server, label, 0, ms);
}

export async function gracefulCloseConnection(
  server: RunningServer,
  connection: CBConnectionActorHandle,
): Promise<void> {
  const openBefore = server.ctx.connections.size;
  expect(openBefore).to.be.greaterThan(0);
  await raceTimeout(
    (async () => {
      await raceTimeout(closeConnection(connection), "close", MS.close);
      await waitForRegistrySize(server, "close-registry", openBefore - 1, MS.close);
    })(),
    "graceful-close-connection",
    MS.close + 250,
  );
}

const liveServers: MockRunningServer[] = [];

async function teardownServer(server: MockRunningServer): Promise<void> {
  const idx = liveServers.indexOf(server);
  if (idx >= 0) {
    liveServers.splice(idx, 1);
  }
  if (server.actor.hsm.currentStateName === "Running") {
    server.actor.notify.stop();
    await waitForServerState(server, "Stopped", "teardown-stop", MS.stop);
    server.port.advance(server.ctx.config.mmkit.killGraceMs + 10);
    await syncServer(server, "teardown-advance");
  }
  expect(server.ctx.pid).to.equal(undefined);
  await waitForEmptyRegistry(server, "teardown-registry");
}

export async function withMockSession(
  label: string,
  work: (session: TestSession) => Promise<void>,
): Promise<void> {
  const server = await bootRunning(await makeConfig(label));
  let connection: CBConnectionActorHandle | undefined;
  try {
    connection = await openConnection(server);
    await runTimed(`session-body:${label}`, () => work({ server, connection: connection! }), MS.session);
  } finally {
    if (connection !== undefined) {
      await gracefulCloseConnection(server, connection);
    }
    await teardownServer(server);
  }
}

export async function withMockServer(
  label: string,
  work: (server: RunningServer) => Promise<void>,
): Promise<void> {
  const server = await bootRunning(await makeConfig(label));
  try {
    await runTimed(`server-body:${label}`, () => work(server), MS.session);
  } finally {
    await teardownServer(server);
  }
}

export function installMockTestGuards(suite: Mocha.Suite): void {
  suite.afterEach(async function () {
    this.timeout(MS.teardown + 2_000);
    while (liveServers.length > 0) {
      await teardownServer(liveServers[0]!);
    }
  });
}
