import * as ihsm from "ihsm";
import type { CBAnswer } from "../../shared/CBServerDefs";
import type { ICBConnectionReaderContext } from "./CBConnectionReaderContext";

/** ihsm Config bag for the TCP reader child (connection session). */
export interface CBConnectionReaderMachineConfig {
  context: ICBConnectionReaderContext;
  notifications: {
    interrupt(): void;
    beginAwait(): void;
  };
  services: {
    initialize(): Promise<void>;
  };
  internalNotifications: {
    onData(chunk: string): void;
    onEnd(): void;
    onStreamClose(): void;
    onStreamError(message: string): void;
    onAnswerReady(answer: CBAnswer): void;
  };
}

export type CBConnectionReaderActor = ihsm.ChildActor<CBConnectionReaderMachineConfig>;

/** Root composite state — no handlers; descendants define behavior. */
export class CBConnectionReaderTop extends ihsm.TopState<CBConnectionReaderMachineConfig> {
  protected _checkInvariant(): void {}
}
