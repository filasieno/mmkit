import * as ihsm from "ihsm";
import type { CBServerActorRef } from "../server/CBServerConfig";
import type { IStderrReaderContext } from "./CBServerStderrReaderContext";

/** ihsm Config bag for the process stderr log line-reader (supervisor child). */
export interface StderrLogReaderMachineConfig {
  context: IStderrReaderContext;
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

/** Supervisor child — stderr process log lines only. */
export type CBStderrLogReaderActor = ihsm.ChildActor<StderrLogReaderMachineConfig>;

export type { CBServerActorRef };

/** Root composite state — no handlers; descendants define behavior. */
export class StderrLogReaderTop extends ihsm.TopState<StderrLogReaderMachineConfig> {
  protected _checkInvariant(): void {}
}
