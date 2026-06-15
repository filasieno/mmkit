import * as ihsm from "ihsm/testing";
import {
  CBConnectionTop,
  type CBConnectionActorRef,
} from "../../src/cbserver/actors/connection/CBServerConnectionConfig";
import type { ICBCommandChannelContext } from "../../src/cbserver/actors/commandChannel/CBCommandChannelContext";
import type { ICBNotificationChannelContext } from "../../src/cbserver/actors/notificationChannel/CBNotificationChannelContext";
import type { CBCommandChannelPortConfig, CBCommandChannelActor } from "../../src/cbserver/actors/commandChannel/CBCommandChannelConfig";
import type {
  CBNotificationChannelPortConfig,
  CBNotificationChannelActor,
} from "../../src/cbserver/actors/notificationChannel/CBNotificationChannelConfig";
import { CBCommandChannelTop } from "../../src/cbserver/actors/commandChannel/CBCommandChannelConfig";
import { CBNotificationChannelTop } from "../../src/cbserver/actors/notificationChannel/CBNotificationChannelConfig";
import { CommandUninitialized } from "../../src/cbserver/actors/commandChannel/CBCommandChannelActor";
import { NotificationUninitialized } from "../../src/cbserver/actors/notificationChannel/CBNotificationChannelActor";
import { spawnTestChildActor } from "./cbChildSpawnTest";

@ihsm.mock("spawnCommandChannel", "spawnNotificationChannel")
export abstract class MockCBConnectionOrchestratorPort extends ihsm.TestPort<typeof CBConnectionTop> {
  abstract spawnCommandChannel(
    parent: CBConnectionActorRef,
    ctx: ICBCommandChannelContext,
    channelPort: CBCommandChannelPortConfig,
  ): Promise<CBCommandChannelActor>;

  abstract spawnNotificationChannel(
    parent: CBConnectionActorRef,
    ctx: ICBNotificationChannelContext,
    channelPort: CBNotificationChannelPortConfig,
  ): Promise<CBNotificationChannelActor>;
}

export function wireDefaultChannelSpawns(
  port: ReturnType<typeof ihsm.makeTestPort<MockCBConnectionOrchestratorPort>>,
): void {
  port.spawnCommandChannel.default(async (_parent, ctx, channelPort) => {
    const child = spawnTestChildActor(CBCommandChannelTop, ctx, channelPort as never, { initialize: false });
    child.hsm.restore(CommandUninitialized, ctx);
    await child.call.initialize();
    return child as CBCommandChannelActor;
  });
  port.spawnNotificationChannel.default(async (_parent, ctx, channelPort) => {
    const child = spawnTestChildActor(CBNotificationChannelTop, ctx, channelPort as never, { initialize: false });
    child.hsm.restore(NotificationUninitialized, ctx);
    await child.call.initialize();
    return child as CBNotificationChannelActor;
  });
}

export function makeMockConnectionOrchestratorPort(): ReturnType<
  typeof ihsm.makeTestPort<MockCBConnectionOrchestratorPort>
> {
  const port = ihsm.makeTestPort(MockCBConnectionOrchestratorPort);
  wireDefaultChannelSpawns(port);
  return port;
}
