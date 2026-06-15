import * as ihsm from "ihsm";
import type { CBAnswer } from "../../shared/CBServerDefs";
import type { ICBNotificationChannelContext } from "./CBNotificationChannelContext";
import type { CBConnectionReaderActor } from "../reader/CBConnectionReaderConfig";
import type { CBConnectionWriterActor } from "../writer/CBConnectionWriterConfig";

/** Public `call` surface for the notification TCP channel actor. */
export interface CBNotificationChannelServices {
  initialize(): Promise<void>;
  getRawClientId(): Promise<string>;
}

/** Parent/orchestrator-driven notification channel commands. */
export interface CBNotificationChannelNotifications {
  close(): void;
  beginGetNotification(timeoutMs?: number): void;
}

export type CBNotificationChannelTcpChildren = {
  reader: CBConnectionReaderActor;
  writer: CBConnectionWriterActor;
};

/** Port contract — TCP socket I/O for the notification channel. */
export interface CBNotificationChannelPortConfig {
  open(): Promise<void>;
  write(buffer: Buffer): Promise<void>;
  destroy(): void;
  spawnTcpChildren(
    channel: CBNotificationChannelActorRef,
  ): Promise<CBNotificationChannelTcpChildren>;
}

export interface CBNotificationChannelInternalNotifications {
  onSocketConnect(): void;
  onSocketData(chunk: string): void;
  onSocketDrain(): void;
  onSocketEnd(): void;
  onSocketClose(hadError: boolean): void;
  onSocketError(errorMessage: string): void;
  onSocketTimeout(): void;
  onWriterComplete(): void;
  onWriterFailed(message: string): void;
  onWriterInterrupted(): void;
  onReaderAnswer(answer: CBAnswer): void;
  onReaderFailed(message: string): void;
  onReaderNotification(answer: CBAnswer): void;
  onReaderInterrupted(): void;
  onNotificationReady(answer: CBAnswer): void;
  doConnect(): void;
  doSpawnTcpChildren(): void;
  doBeginEnroll(): void;
  doWriteEnroll(): void;
  doFailEnroll(message: string): void;
  doCompleteEnroll(answer: CBAnswer): void;
  doWriteCancel(): void;
  doNotificationReadTimeout(): void;
  doFinalizeClose(): void;
  doBreakTransport(message: string): void;
  doDispatchInterrupt(): void;
  doFinalizeDetach(): void;
}

/** ihsm Config bag for notification channel actor. */
export interface CBNotificationChannelMachineConfig {
  context: ICBNotificationChannelContext;
  services: CBNotificationChannelServices;
  notifications: CBNotificationChannelNotifications;
  internalNotifications: CBNotificationChannelInternalNotifications;
  port: CBNotificationChannelPortConfig;
}

export type CBNotificationChannelPort = ihsm.DomainPortOf<CBNotificationChannelMachineConfig>;
export type CBNotificationChannelPortHandle = ihsm.IPort<CBNotificationChannelMachineConfig>;
export type CBNotificationChannelActorRef = ihsm.InboundActor<CBNotificationChannelMachineConfig>;
export type CBNotificationChannelActor = ihsm.ChildActor<CBNotificationChannelMachineConfig>;

/** Root composite state — no handlers; descendants define behavior. */
export class CBNotificationChannelTop extends ihsm.TopState<CBNotificationChannelMachineConfig> {
  protected _checkInvariant(): void {}
}
