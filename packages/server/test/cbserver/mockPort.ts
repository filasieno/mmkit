import * as ihsm from "ihsm/testing";
import { CBServerTop, Uninitialized } from "../../src/cbserver/actors/server/CBServerActor";
import type { CBServerConfig, CBServerActorRef } from "../../src/cbserver/actors/server/CBServerConfig";
import type { CBServerContext } from "../../src/cbserver/actors/server/CBServerContext";
import {
  CBConnectionTop,
  type CBConnectionActor,
} from "../../src/cbserver/actors/connection/CBServerConnectionConfig";
import { ConnectionUninitialized } from "../../src/cbserver/actors/connection/CBServerConnectionActor";
import type { CBConnectionContext } from "../../src/cbserver/actors/connection/CBServerConnectionContext";
import type { CBConnectionOrchestratorPort } from "../../src/cbserver/actors/connection/CBConnectionOrchestratorPort";
import type { TcpListenProbeOptions } from "../../src/cbserver/actors/server/tcpPortProbe";
import type { LogReaderChildren } from "../../src/cbserver/actors/server/spawnLogReaderChildren";
import { spawnTestChildActor } from "./cbChildSpawnTest";
import { testSpawnLogReaderChildren } from "./mockChildSpawnArms";
import { makeMockConnectionOrchestratorPort } from "./mockConnectionOrchestratorPort";

@ihsm.mock("spawn", "kill", "awaitTcpListen", "armLogReaders", "spawnConnection")
export abstract class MockCBServerPort extends ihsm.TestPort<typeof CBServerTop> {
  abstract spawn(config: CBServerConfig): Promise<ihsm.ResultWithSubscription<number>>;
  abstract kill(pid: number, signal?: NodeJS.Signals): Promise<void>;
  abstract awaitTcpListen(
    options: TcpListenProbeOptions,
  ): Promise<void>;
  abstract armLogReaders(
    server: CBServerActorRef,
  ): Promise<LogReaderChildren>;
  abstract spawnConnection(
    server: CBServerActorRef,
    context: CBConnectionContext,
    orchestratorPort: CBConnectionOrchestratorPort,
  ): Promise<CBConnectionActor>;
}

export function wireDefaultSpawn(port: ReturnType<typeof ihsm.makeTestPort<MockCBServerPort>>, pid = 10_002): void {
  port.spawn.default(async () => ({
    value: pid,
    subscription: { dispose: () => port.record("dispose-subscription", pid) },
  }));
  port.kill.default(async (targetPid, signal) => {
    port.record("kill", targetPid, signal);
  });
  port.awaitTcpListen.default(async () => undefined);
  port.armLogReaders.default(async (server) => testSpawnLogReaderChildren(server));
  port.spawnConnection.default(async (_server, context) => {
    const orchestratorPort = makeMockConnectionOrchestratorPort();
    const child = spawnTestChildActor(CBConnectionTop, context, orchestratorPort, { initialize: false });
    child.hsm.restore(ConnectionUninitialized, context);
    await child.call.initialize();
    return child as CBConnectionActor;
  });
}

export function makeMockPort(pid = 10_002) {
  const port = ihsm.makeTestPort(MockCBServerPort);
  wireDefaultSpawn(port, pid);
  return port;
}

/** Boot supervisor into {@link Running} with log readers armed. */
export async function bootRunning(ctx: CBServerContext, port: ReturnType<typeof makeMockPort>, pid = 10_002) {
  const actor = ihsm.makeTestActor(CBServerTop, ctx, port, { initialize: false });
  actor.hsm.restore(Uninitialized, ctx);
  await actor.call.initialize();
  await actor.hsm.sync();

  actor.notify.start();
  await actor.hsm.sync();
  await actor.hsm.sync();

  return actor;
}
