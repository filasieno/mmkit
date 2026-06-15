import * as ihsm from "ihsm";
import type { IStderrReaderContext } from "./CBServerStderrReaderContext";

export interface StderrLogReaderNotifications {
  stop(): void;
  interrupt(): void;
}

export interface StderrLogReaderServices {
  getCurrentStateName(): Promise<string>;
}

export interface StderrLogReaderInternalNotifications {
  onData(chunk: string): void;
  onEnd(): void;
  onStreamClose(): void;
  onStreamError(message: string): void;
}

export interface StderrLogReaderMachineConfig {
  context: IStderrReaderContext;
  notifications: StderrLogReaderNotifications;
  services: StderrLogReaderServices;
  internalNotifications: StderrLogReaderInternalNotifications;
}

export type CBStderrLogReaderActor = ihsm.ChildActor<StderrLogReaderMachineConfig>;

export class StderrLogReaderTop extends ihsm.TopState<StderrLogReaderMachineConfig> {
  protected _checkInvariant(): void {}
}
