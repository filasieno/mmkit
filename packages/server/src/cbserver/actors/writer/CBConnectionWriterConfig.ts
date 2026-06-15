import * as ihsm from "ihsm";
import type { ICBConnectionWriterContext } from "./CBConnectionWriterContext";

/** ihsm Config bag for the TCP writer child (connection session). */
export interface CBConnectionWriterMachineConfig {
  context: ICBConnectionWriterContext;
  notifications: {
    interrupt(): void;
  };
  services: {
    initialize(): Promise<void>;
    sendFrame(frame: Buffer): Promise<void>;
  };
  internalNotifications: {
    onWriteComplete(): void;
    onWriteFailed(message: string): void;
    doWriteFrame(frame: Buffer): void;
  };
  port: {
    write(buffer: Buffer): Promise<void>;
  };
}

export type CBConnectionWriterActor = ihsm.ChildActor<CBConnectionWriterMachineConfig>;

/** Root composite state — no handlers; descendants define behavior. */
export class CBConnectionWriterTop extends ihsm.TopState<CBConnectionWriterMachineConfig> {
  protected _checkInvariant(): void {}
}
