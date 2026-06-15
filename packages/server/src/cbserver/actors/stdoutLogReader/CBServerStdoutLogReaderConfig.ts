import * as ihsm from "ihsm";
import type { IStdoutLogReaderContext } from "./CBServerStdoutLogReaderContext";

export interface StdoutLogReaderNotifications {
  stop(): void;
  interrupt(): void;
}

export interface StdoutLogReaderServices {
  getCurrentStateName(): Promise<string>;
}

export interface StdoutLogReaderInternalNotifications {
  onData(chunk: string): void;
  onEnd(): void;
  onStreamClose(): void;
  onStreamError(message: string): void;
}

export interface StdoutLogReaderMachineConfig {
  context: IStdoutLogReaderContext;
  notifications: StdoutLogReaderNotifications;
  services: StdoutLogReaderServices;
  internalNotifications: StdoutLogReaderInternalNotifications;
}

export type CBStdoutLogReaderActor = ihsm.ChildActor<StdoutLogReaderMachineConfig>;

export class StdoutLogReaderTop extends ihsm.TopState<StdoutLogReaderMachineConfig> {
  protected _checkInvariant(): void {}
}
