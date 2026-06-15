import * as ihsm from "ihsm";
import type { ICBConnectionContext } from "./CBServerConnectionContext";
import type { ICBCommandChannelContext } from "../commandChannel/CBCommandChannelContext";
import type { ICBNotificationChannelContext } from "../notificationChannel/CBNotificationChannelContext";
import type { CBCommandChannelPortInput, CBCommandChannelActor } from "../commandChannel/CBCommandChannelConfig";
import type { CBNotificationChannelPortInput, CBNotificationChannelActor } from "../notificationChannel/CBNotificationChannelConfig";
import type { CBCommandRequest } from "./CBCommandRequest";

export interface CBConnectionServices {
  getConnectionId(): Promise<string>;
  getClientId(): Promise<string>;
  getNotificationClientId(): Promise<string>;
  tell(frames: string): Promise<CBCommandRequest>;
  untell(frames: string): Promise<CBCommandRequest>;
  retell(untellFrames: string, tellFrames: string): Promise<CBCommandRequest>;
  tellModel(...files: string[]): Promise<CBCommandRequest>;
  ask(query: string, queryFormat?: string, answerRep?: string, rollbackTime?: string): Promise<CBCommandRequest>;
  hypoAsk(frames: string, query: string, queryFormat?: string, answerRep?: string, rollbackTime?: string): Promise<CBCommandRequest>;
  lpicall(lpiCall: string): Promise<CBCommandRequest>;
  prolog(statement: string): Promise<CBCommandRequest>;
  why(): Promise<CBCommandRequest>;
  cd(modulePath?: string): Promise<CBCommandRequest>;
  pwd(): Promise<CBCommandRequest>;
  lm(modulePath?: string): Promise<CBCommandRequest>;
  ls(className?: string): Promise<CBCommandRequest>;
  mkdir(moduleName: string): Promise<CBCommandRequest>;
  who(): Promise<CBCommandRequest>;
  sub(): Promise<CBCommandRequest>;
  show(objectName: string): Promise<CBCommandRequest>;
  nextMessage(messageType?: string): Promise<CBCommandRequest>;
  stopServer(password?: string): Promise<CBCommandRequest>;
  reportClients(): Promise<CBCommandRequest>;
  notificationRequest(about: string, tool?: string): Promise<CBCommandRequest>;
  getNotificationMessage(timeoutMs?: number): Promise<CBCommandRequest>;
}

export interface CBConnectionNotifications {
  close(): void;
}

export interface CBConnectionInternalNotifications {
  doSpawnChannels(): void;
  doFinalizeClose(): void;
  doBreakTransport(message: string): void;
  doProcessCommandQueue(): void;
  doCloseAfterDrain(): void;
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
