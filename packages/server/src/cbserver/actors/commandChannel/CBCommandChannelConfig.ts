import * as ihsm from "ihsm";
import type { CBAnswer } from "../../shared/CBServerDefs";
import type { ICBCommandChannelContext } from "./CBCommandChannelContext";
import type { CBConnectionReaderActor } from "../reader/CBConnectionReaderConfig";
import type { CBConnectionWriterActor } from "../writer/CBConnectionWriterConfig";

/** Public `call` surface for the command TCP channel actor. */
export interface CBCommandChannelServices {
  getRawClientId(): Promise<string>;
}

/** Parent/orchestrator-driven IPC commands (sync — not on `call`). */
export interface CBCommandChannelNotifications {
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
  dispatchNotificationRequest(about: string, tool: string): void;
}

export type CBCommandChannelTcpChildren = {
  reader: CBConnectionReaderActor;
  writer: CBConnectionWriterActor;
};

/** Port contract — TCP socket I/O for the command channel. */
export interface CBCommandChannelPortConfig {
  open(): Promise<void>;
  write(buffer: Buffer): Promise<void>;
  destroy(): void;
  spawnTcpChildren( channel: CBCommandChannelActorRef ): Promise<CBCommandChannelTcpChildren>;
}

export interface CBCommandChannelInternalNotifications {
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
  doConnect(): void;
  doSpawnTcpChildren(): void;
  doBeginEnroll(): void;
  doProcessNext(): void;
  doWriteActive(): void;
  doReadActive(): void;
  doReadComplete(answer: CBAnswer): void;
  doFailActive(message: string): void;
  doFinalizeClose(): void;
  doBreakTransport(message: string): void;
  doDispatchInterrupt(): void;
  doFinalizeDetach(): void;
}

/** ihsm Config bag for command channel actor. */
export interface CBCommandChannelMachineConfig {
  context: ICBCommandChannelContext;
  services: CBCommandChannelServices;
  notifications: CBCommandChannelNotifications;
  internalNotifications: CBCommandChannelInternalNotifications;
  port: CBCommandChannelPortConfig;
}

export type CBCommandChannelPort = ihsm.DomainPortOf<CBCommandChannelMachineConfig>;
export type CBCommandChannelPortHandle = ihsm.IPort<CBCommandChannelMachineConfig>;
/** A concrete port object: the domain contract plus a runtime port the actor runtime can bind. */
export type CBCommandChannelPortInput = CBCommandChannelPortConfig & ihsm.MachinePortInput<CBCommandChannelMachineConfig>;
export type CBCommandChannelActorRef = ihsm.InboundActor<CBCommandChannelMachineConfig>;
export type CBCommandChannelActor = ihsm.ChildActor<CBCommandChannelMachineConfig>;

/** Root composite state — no handlers; descendants define behavior. */
export class CBCommandChannelTop extends ihsm.TopState<CBCommandChannelMachineConfig> {
  protected _checkInvariant(): void {}
}
