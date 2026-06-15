import * as ihsm from "ihsm";
import type { ICBConnectionContext } from "./CBServerConnectionContext";
import type { ICBCommandChannelContext } from "../commandChannel/CBCommandChannelContext";
import type { ICBNotificationChannelContext } from "../notificationChannel/CBNotificationChannelContext";
import type { CBCommandChannelPortInput, CBCommandChannelActor } from "../commandChannel/CBCommandChannelConfig";
import type { CBNotificationChannelPortInput, CBNotificationChannelActor } from "../notificationChannel/CBNotificationChannelConfig";

export interface CBConnectionServices {
  initialize(): Promise<void>;
  getConnectionId(): Promise<string>;
  getClientId(): Promise<string>;
  getNotificationClientId(): Promise<string>;
}

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

export interface CBConnectionInternalNotifications {
  doSpawnChannels(): void;
  doFinalizeClose(): void;
  doBreakTransport(message: string): void;
  onCommandChannelClosed(): void;
  onNotificationChannelClosed(): void;
  onCommandChannelBroken(message: string): void;
  onNotificationChannelBroken(message: string): void;
}

export interface CBConnectionPort {
  spawnCommandChannel( parent: ihsm.ParentActor<typeof CBConnectionTop>, ctx: ICBCommandChannelContext, channelPort: CBCommandChannelPortInput ): Promise<CBCommandChannelActor>;
  spawnNotificationChannel( parent: ihsm.ParentActor<typeof CBConnectionTop>, ctx: ICBNotificationChannelContext, channelPort: CBNotificationChannelPortInput ): Promise<CBNotificationChannelActor>;
}

/** ihsm Config bag for the CBServer connection orchestrator actor. */
export interface CBConnectionMachineConfig {
  context: ICBConnectionContext;
  services: CBConnectionServices;
  notifications: CBConnectionNotifications;
  internalNotifications: CBConnectionInternalNotifications;
  port: CBConnectionPort;
}

export type CBConnectionActor = ihsm.ChildActor<CBConnectionMachineConfig>;
export type CBConnectionActorRef = ihsm.InboundActor<CBConnectionMachineConfig>;
export type CBConnectionActorHandle = ihsm.ExternalActor<CBConnectionMachineConfig>;
export class CBConnectionTop extends ihsm.TopState<CBConnectionMachineConfig> {
  protected _checkInvariant(): void {}
}
