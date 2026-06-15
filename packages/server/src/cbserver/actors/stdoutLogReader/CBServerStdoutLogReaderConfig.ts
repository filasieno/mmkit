import * as ihsm from "ihsm";
import type { CBServerActorRef } from "../server/CBServerConfig";
import type { IStdoutLogReaderContext } from "./CBServerStdoutLogReaderContext";

/** ihsm Config bag for the process stdout log line-reader (supervisor child). */
export interface StdoutLogReaderMachineConfig {
  context: IStdoutLogReaderContext;
  notifications: {
    stop(): void;
    interrupt(): void;
  };
  services: {
    initialize(): Promise<void>;
    getCurrentStateName(): Promise<string>;
  };
  internalNotifications: {
    onData(chunk: string): void;
    onEnd(): void;
    onStreamClose(): void;
    onStreamError(message: string): void;
  };
}

/** Supervisor child — stdout process log lines only. */
export type CBStdoutLogReaderActor = ihsm.ChildActor<StdoutLogReaderMachineConfig>;

/** Root composite state — no handlers; descendants define behavior. */
export class StdoutLogReaderTop extends ihsm.TopState<StdoutLogReaderMachineConfig> {
  protected _checkInvariant(): void {}
}

export type { CBServerActorRef };
