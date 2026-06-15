import * as ihsm from "ihsm";
import type { CBAnswer } from "../../shared/CBServerDefs";
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
import type { ICBConnectionContext } from "./CBServerConnectionContext";

/** Public `call` surface for the connection orchestrator actor. */
export interface CBConnectionServices {
  initialize(): Promise<void>;
  getConnectionId(): Promise<string>;
  getClientId(): Promise<string>;
  getNotificationClientId(): Promise<string>;
}

/** Parent/handle-driven connection commands (sync — not on `call`). */
export interface CBConnectionNotifications {
  close(): void;
  dispatchTell(frames: string): void;
  dispatchUntell(frames: string): void;
  dispatchRetell(untellFrames: string, tellFrames: string): void;
  dispatchTellModel(...files: string[]): void;
  dispatchAsk(query: string, queryFormat?: string, answerRep?: string, rollbackTime?: string): void;
  dispatchHypoAsk(frames: string, query: string, queryFormat?: string, answerRep?: string, rollbackTime?: string): void;
  dispatchLpicall(lpiCall: string): void;
  dispatchProlog(statement: string): void;
  dispatchWhy(): void;
  dispatchCd(modulePath?: string): void;
  dispatchPwd(): void;
  dispatchLm(modulePath?: string): void;
  dispatchLs(className?: string): void;
  dispatchMkdir(moduleName: string): void;
  dispatchWho(): void;
  dispatchSub(): void;
  dispatchShow(objectName: string): void;
  dispatchNextMessage(messageType?: string): void;
  dispatchStopServer(password?: string): void;
  dispatchReportClients(): void;
  dispatchNotificationRequest(about: string, tool?: string): void;
  dispatchGetNotificationMessage(timeoutMs?: number): void;
}

/** ihsm Config bag for the CBServer connection orchestrator actor. */
export interface CBConnectionMachineConfig {
  context: ICBConnectionContext;
  services: CBConnectionServices;
  notifications: CBConnectionNotifications;
  internalNotifications: {
    doSpawnChannels(): void;
    doFinalizeClose(): void;
    doBreakTransport(message: string): void;
    onCommandChannelClosed(): void;
    onNotificationChannelClosed(): void;
    onCommandChannelBroken(message: string): void;
    onNotificationChannelBroken(message: string): void;
  };
  port: {
    spawnCommandChannel(
      parent: CBConnectionActorRef,
      ctx: ICBCommandChannelContext,
      channelPort: CBCommandChannelPortConfig,
    ): Promise<CBCommandChannelActor>;
    spawnNotificationChannel(
      parent: CBConnectionActorRef,
      ctx: ICBNotificationChannelContext,
      channelPort: CBNotificationChannelPortConfig,
    ): Promise<CBNotificationChannelActor>;
  };
}

export type CBConnectionActor = ihsm.ChildActor<CBConnectionMachineConfig>;
export type CBConnectionActorRef = ihsm.InboundActor<CBConnectionMachineConfig>;
export type CBConnectionActorHandle = ihsm.ExternalActor<CBConnectionMachineConfig>;
export type CBConnectionRegistry = Map<string, CBConnectionActor>;

export type { ICBConnectionContext } from "./CBServerConnectionContext";

/** Root composite state — no handlers; descendants define behavior. */
export class CBConnectionTop extends ihsm.TopState<CBConnectionMachineConfig> {
  protected _checkInvariant(): void {}
}
