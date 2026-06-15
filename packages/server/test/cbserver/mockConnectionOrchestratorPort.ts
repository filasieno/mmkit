import * as ihsm from "ihsm/testing";
import type { CBConnectionTop } from "../../src/cbserver/actors/connection/CBServerConnectionConfig";
import type { ICBCommandChannelContext } from "../../src/cbserver/actors/commandChannel/CBCommandChannelContext";
import type { ICBNotificationChannelContext } from "../../src/cbserver/actors/notificationChannel/CBNotificationChannelContext";
import type { CBCommandChannelPortInput, CBCommandChannelActor } from "../../src/cbserver/actors/commandChannel/CBCommandChannelConfig";
import type { CBNotificationChannelPortInput, CBNotificationChannelActor, } from "../../src/cbserver/actors/notificationChannel/CBNotificationChannelConfig";
import { testSpawnCommandChannel, testSpawnNotificationChannel } from "./cbserverTestSpawn";

@ihsm.mock("spawnCommandChannel", "spawnNotificationChannel")
export abstract class MockCBConnectionOrchestratorPort extends ihsm.TestPort<typeof CBConnectionTop> {
  abstract spawnCommandChannel(
    parent: ihsm.ParentActor<typeof CBConnectionTop>,
    ctx: ICBCommandChannelContext,
    channelPort: CBCommandChannelPortInput,
  ): Promise<CBCommandChannelActor>;

  abstract spawnNotificationChannel(
    parent: ihsm.ParentActor<typeof CBConnectionTop>,
    ctx: ICBNotificationChannelContext,
    channelPort: CBNotificationChannelPortInput,
  ): Promise<CBNotificationChannelActor>;
}

export function makeMockConnectionOrchestratorPort(): ReturnType<
  typeof ihsm.makeTestPort<MockCBConnectionOrchestratorPort>
> {
  const port = ihsm.makeTestPort(MockCBConnectionOrchestratorPort);
  port.spawnCommandChannel.default( async (_parent, ctx, channelPort) => { return testSpawnCommandChannel(ctx, channelPort); } );
  port.spawnNotificationChannel.default( async (_parent, ctx, channelPort) => { return testSpawnNotificationChannel(ctx, channelPort); } );
  return port;
}
