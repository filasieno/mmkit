import * as ihsm from "ihsm";
import type { ICBConnectionWriterContext } from "./CBConnectionWriterContext";

export interface CBConnectionWriterNotifications {
  interrupt(): void;
}

export interface CBConnectionWriterServices {
  initialize(): Promise<void>;
  sendFrame(frame: Buffer): Promise<void>;
}

export interface CBConnectionWriterInternalNotifications {
  onWriteComplete(): void;
  onWriteFailed(message: string): void;
  doWriteFrame(frame: Buffer): void;
}

export interface CBConnectionWriterPort {
  write(buffer: Buffer): Promise<void>;
}

export interface CBConnectionWriterMachineConfig {
  context: ICBConnectionWriterContext;
  notifications: CBConnectionWriterNotifications;
  services: CBConnectionWriterServices;
  internalNotifications: CBConnectionWriterInternalNotifications;
  port: CBConnectionWriterPort;
}

export type CBConnectionWriterActor = ihsm.ChildActor<CBConnectionWriterMachineConfig>;

export class CBConnectionWriterTop extends ihsm.TopState<CBConnectionWriterMachineConfig> {
  protected _checkInvariant(): void {}
}
