import type * as ihsm from "ihsm";
import { spawnChildActor } from "../../shared/cbChildSpawn";
import {
  CBCommandChannelTop,
  type CBCommandChannelActor,
  type CBCommandChannelPortConfig,
} from "../commandChannel/CBCommandChannelConfig";
import type { ICBCommandChannelContext } from "../commandChannel/CBCommandChannelContext";
import { CommandUninitialized } from "../commandChannel/CBCommandChannelActor";
import {
  CBNotificationChannelTop,
  type CBNotificationChannelActor,
  type CBNotificationChannelPortConfig,
} from "../notificationChannel/CBNotificationChannelConfig";
import type { ICBNotificationChannelContext } from "../notificationChannel/CBNotificationChannelContext";
import { NotificationUninitialized } from "../notificationChannel/CBNotificationChannelActor";
import type { CBConnectionTop } from "./CBServerConnectionConfig";

export async function spawnCommandChannelChild(
  parent: ihsm.ParentActor<typeof CBConnectionTop>,
  ctx: ICBCommandChannelContext,
  channelPort: CBCommandChannelPortConfig,
): Promise<CBCommandChannelActor> {
  const child = spawnChildActor(parent, CBCommandChannelTop, ctx, channelPort as never, { initialize: false });
  child.hsm.restore(CommandUninitialized, ctx);
  await child.call.initialize();
  return child;
}

export async function spawnNotificationChannelChild(
  parent: ihsm.ParentActor<typeof CBConnectionTop>,
  ctx: ICBNotificationChannelContext,
  channelPort: CBNotificationChannelPortConfig,
): Promise<CBNotificationChannelActor> {
  const child = spawnChildActor(parent, CBNotificationChannelTop, ctx, channelPort as never, { initialize: false });
  child.hsm.restore(NotificationUninitialized, ctx);
  await child.call.initialize();
  return child;
}
