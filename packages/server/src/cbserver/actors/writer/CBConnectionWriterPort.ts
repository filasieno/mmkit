import * as ihsm from "ihsm";
import type { CBConnectionSocketWrite } from "../connection/CBConnectionPort";
import { CBConnectionWriterTop } from "./CBConnectionWriterConfig";

/** Delegates `write` to the connection socket port. */
export class CBConnectionWriterPort extends ihsm.Port<typeof CBConnectionWriterTop> {
  constructor(private readonly socket: CBConnectionSocketWrite) {
    super();
  }

  async write(buffer: Buffer): Promise<void> {
    return this.socket.write(buffer);
  }
}
