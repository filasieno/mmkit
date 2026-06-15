import * as ihsm from "ihsm/testing";
import { CBServerTop, Uninitialized } from "../../src/cbserver/actors/server/CBServerActor";
import type { CBServerActorRef, LogReaderChildren } from "../../src/cbserver/actors/server/CBServerConfig";
import type { CBServerConfig } from "../../src/cbserver/actors/server/settings/CBServerSettings";
import type { CBServerContext } from "../../src/cbserver/actors/server/CBServerContext";
import type { CBConnectionContext } from "../../src/cbserver/actors/connection/CBServerConnectionContext";
import type { CBConnectionOrchestratorPort } from "../../src/cbserver/actors/connection/CBConnectionOrchestratorPort";
import type { CBConnectionActor } from "../../src/cbserver/actors/connection/CBServerConnectionConfig";
import type { TcpConnectProbeOptions } from "../../src/cbserver/actors/server/tcpPortProbe";
import { testSpawnLogReaderChildren, testSpawnConnectionChild } from "./cbserverTestSpawn";
import { makeMockConnectionOrchestratorPort } from "./mockConnectionOrchestratorPort";
import { makeMockChannelPair } from "./mockTcpSocket";

let mockConnectionSeq = 0;

@ihsm.mock("spawn", "kill", "probeTcpConnect", "armLogReaders", "spawnConnection")
export abstract class MockCBServerPort extends ihsm.TestPort<typeof CBServerTop> {
  abstract spawn(config: CBServerConfig): Promise<ihsm.ResultWithSubscription<number>>;
  abstract kill(pid: number, signal?: NodeJS.Signals): Promise<void>;
  abstract probeTcpConnect(options: TcpConnectProbeOptions): Promise<boolean>;
  abstract armLogReaders(
    server: CBServerActorRef,
  ): Promise<LogReaderChildren>;
  abstract spawnConnection(
    server: CBServerActorRef,
    context: CBConnectionContext,
    orchestratorPort: CBConnectionOrchestratorPort,
  ): Promise<CBConnectionActor>;
}

export function makeMockPort(pid = 10_002) {
  const port = ihsm.makeTestPort(MockCBServerPort);
  port.spawn.default(
    async () => ({
      value: pid,
      subscription: { dispose: () => port.record("dispose-subscription", pid) },
    }),
  );
  port.kill.default(async (targetPid, signal) => {
    port.record("kill", targetPid, signal);
    port.send("onProcessExit", 0, null);
  });
  port.probeTcpConnect.default(async () => true);
  port.armLogReaders.default(async (server) => testSpawnLogReaderChildren(server));
  port.spawnConnection.default(async (_server, context, _orchestratorPort) => {
    const seq = ++mockConnectionSeq;
    const pair = makeMockChannelPair(`mock-cmd-${seq}`, `mock-notif-${seq}`);
    pair.session.onStopServer = () => {
      port.send("onProcessExit", 0, null);
    };
    context.channelPorts = {
      command: pair.command,
      notification: pair.notification,
    };
    const orchestratorPort = makeMockConnectionOrchestratorPort() as unknown as CBConnectionOrchestratorPort;
    return testSpawnConnectionChild(context, orchestratorPort);
  });
  return port;
}

/** Boot supervisor into {@link Running} with log readers armed. */
export async function bootRunning(ctx: CBServerContext, port: ReturnType<typeof makeMockPort>, pid = 10_002) {
  const actor = ihsm.makeTestActor(CBServerTop, ctx, port);
  actor.hsm.restore(Uninitialized, ctx);
  await actor.hsm.sync();
  const init = await actor.call.initialize();
  await init.wait();
  await actor.hsm.sync();

  actor.notify.start();
  await actor.hsm.sync();
  await actor.hsm.sync();

  void pid;
  return actor;
}
