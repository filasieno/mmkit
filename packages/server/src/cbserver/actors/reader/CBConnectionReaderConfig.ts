import * as ihsm from "ihsm";
import type { CBAnswer } from "../../shared/CBServerDefs";
import type { ICBConnectionReaderContext } from "./CBConnectionReaderContext";

export interface CBConnectionReaderNotifications {
  interrupt(): void;
  beginAwait(): void;
}


export interface CBConnectionReaderInternalNotifications {
  onData(chunk: string): void;
  onEnd(): void;
  onStreamClose(): void;
  onStreamError(message: string): void;
  onAnswerReady(answer: CBAnswer): void;
}

export interface CBConnectionReaderMachineConfig {
  context: ICBConnectionReaderContext;
  notifications: CBConnectionReaderNotifications;
  internalNotifications: CBConnectionReaderInternalNotifications;
}

export type CBConnectionReaderActor = ihsm.ChildActor<CBConnectionReaderMachineConfig>;

export class CBConnectionReaderTop extends ihsm.TopState<CBConnectionReaderMachineConfig> {
  protected _checkInvariant(): void {}
}
