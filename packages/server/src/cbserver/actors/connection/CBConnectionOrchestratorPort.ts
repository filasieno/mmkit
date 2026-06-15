import * as ihsm from "ihsm";
import { CbActorSpawnOptions } from "../../shared/cbActorSpawnOptions";
import type { CBConnectionTop } from "./CBServerConnectionConfig";
import type { ICBCommandChannelContext } from "../commandChannel/CBCommandChannelContext";
import type { ICBNotificationChannelContext } from "../notificationChannel/CBNotificationChannelContext";
import { CBCommandChannelTop } from "../commandChannel/CBCommandChannelConfig";
import type { CBCommandChannelActor, CBCommandChannelPortInput } from "../commandChannel/CBCommandChannelConfig";
import "../commandChannel/CBCommandChannelActor";
import { CBNotificationChannelTop } from "../notificationChannel/CBNotificationChannelConfig";
import type { CBNotificationChannelActor, CBNotificationChannelPortInput } from "../notificationChannel/CBNotificationChannelConfig";
import "../notificationChannel/CBNotificationChannelActor";

/** Connection orchestrator port — child channel spawn + mailbox binding. */
export class CBConnectionOrchestratorPort extends ihsm.Port<typeof CBConnectionTop> {
  async spawnCommandChannel( parent: ihsm.ParentActor<typeof CBConnectionTop>, ctx: ICBCommandChannelContext, channelPort: CBCommandChannelPortInput ): Promise<CBCommandChannelActor> {
    const child: CBCommandChannelActor = ihsm.makeChildActor(parent, CBCommandChannelTop, ctx, channelPort, new CbActorSpawnOptions(),);
    await child.hsm.sync();
    await child.call.initialize();
    return child;
  }

  async spawnNotificationChannel( parent: ihsm.ParentActor<typeof CBConnectionTop>, ctx: ICBNotificationChannelContext, channelPort: CBNotificationChannelPortInput ): Promise<CBNotificationChannelActor> {
    const child: CBNotificationChannelActor = ihsm.makeChildActor(parent, CBNotificationChannelTop, ctx, channelPort, new CbActorSpawnOptions(),);
    await child.hsm.sync();
    await child.call.initialize();
    return child;
  }
}
