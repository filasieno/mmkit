import * as ihsm from "ihsm";
import { CBConnectionTop } from "./CBServerConnectionConfig";
import type { ICBCommandChannelContext } from "../commandChannel/CBCommandChannelContext";
import type { ICBNotificationChannelContext } from "../notificationChannel/CBNotificationChannelContext";
import type {
  CBCommandChannelPortConfig,
  CBCommandChannelActor,
} from "../commandChannel/CBCommandChannelConfig";
import type {
  CBNotificationChannelPortConfig,
  CBNotificationChannelActor,
} from "../notificationChannel/CBNotificationChannelConfig";
import { spawnCommandChannelChild, spawnNotificationChannelChild } from "./spawnChannelChildren";
import type { CBConnectionActorRef } from "./CBServerConnectionConfig";

/** Connection orchestrator port — child channel spawn + mailbox binding. */
export class CBConnectionOrchestratorPort extends ihsm.Port<typeof CBConnectionTop> {
  async spawnCommandChannel(
    parent: CBConnectionActorRef,
    ctx: ICBCommandChannelContext,
    channelPort: CBCommandChannelPortConfig,
  ): Promise<CBCommandChannelActor> {
    return spawnCommandChannelChild(parent as never as ihsm.ParentActor<typeof CBConnectionTop>, ctx, channelPort);
  }

  async spawnNotificationChannel(
    parent: CBConnectionActorRef,
    ctx: ICBNotificationChannelContext,
    channelPort: CBNotificationChannelPortConfig,
  ): Promise<CBNotificationChannelActor> {
    return spawnNotificationChannelChild(parent as never as ihsm.ParentActor<typeof CBConnectionTop>, ctx, channelPort);
  }
}
