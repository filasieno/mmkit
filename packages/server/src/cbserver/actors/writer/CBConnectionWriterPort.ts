import * as ihsm from "ihsm";
import type { CBConnectionWriterTop } from "./CBConnectionWriterConfig";

/** Delegates `write` to the channel socket port. */
export class CBConnectionWriterPort extends ihsm.Port<typeof CBConnectionWriterTop> {
  constructor(private readonly socket: { write(buffer: Buffer): Promise<void> }) {
    super();
  }

  async write(buffer: Buffer): Promise<void> {
    return this.socket.write(buffer);
  }
}
