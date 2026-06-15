import * as ihsm from "ihsm";
import type { CBCommandChannelTop, CBCommandChannelActorRef, CBCommandChannelPortConfig } from "./CBCommandChannelConfig";
import type { CBCommandChannelTcpChildren } from "./CBCommandChannelContext";
import type { CBConnectionReaderActor } from "../reader/CBConnectionReaderConfig";
import type { CBConnectionWriterActor } from "../writer/CBConnectionWriterConfig";
import type { CBTcpConnectionOptions } from "../../shared/CBTcpOptions";
import { CBTcpChannelPortBase } from "../../shared/CBTcpChannelPortBase";
import { CbActorSpawnOptions } from "../../shared/cbActorSpawnOptions";
import { CBConnectionReaderTop } from "../reader/CBConnectionReaderActor";
import { CBConnectionReaderContext } from "../reader/CBConnectionReaderContext";
import { CBConnectionWriterTop } from "../writer/CBConnectionWriterActor";
import { CBConnectionWriterContext } from "../writer/CBConnectionWriterContext";
import { CBConnectionWriterPort } from "../writer/CBConnectionWriterPort";

/** Socket `write` surface used by the writer child port. */
export type CBCommandChannelSocketWrite = Pick<CBCommandChannelPortConfig, "write">;

/** Production port — TCP socket I/O for the command channel. */
export class CBCommandChannelPort extends CBTcpChannelPortBase<typeof CBCommandChannelTop> {
  constructor(options: CBTcpConnectionOptions) {
    super(options);
  }

  async spawnTcpChildren(channel: CBCommandChannelActorRef): Promise<CBCommandChannelTcpChildren> {
    const parent: ihsm.ParentActor<typeof CBCommandChannelTop> = channel as never;
    const reader: CBConnectionReaderActor = ihsm.makeChildActor(parent, CBConnectionReaderTop, new CBConnectionReaderContext(channel), undefined, new CbActorSpawnOptions(),);
    const writer: CBConnectionWriterActor = ihsm.makeChildActor(parent, CBConnectionWriterTop, new CBConnectionWriterContext(channel), new CBConnectionWriterPort(this), new CbActorSpawnOptions(),);
    await reader.hsm.sync();
    await writer.hsm.sync();
    await reader.call.initialize();
    await writer.call.initialize();
    return { reader, writer };
  }
}
