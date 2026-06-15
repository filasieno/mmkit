import type * as ihsm from "ihsm";
import { spawnChildActor } from "../../shared/cbChildSpawn";
import { createReaderContext, CBConnectionReaderTop, ReaderUninitialized } from "../reader/CBConnectionReaderActor";
import { CBConnectionWriterTop, createWriterContext, WriterUninitialized } from "../writer/CBConnectionWriterActor";
import { CBConnectionWriterPort } from "../writer/CBConnectionWriterPort";
import type {
  CBNotificationChannelActorRef,
  CBNotificationChannelPortConfig,
  CBNotificationChannelTop,
} from "./CBNotificationChannelConfig";
import type { CBNotificationChannelTcpChildren } from "./CBNotificationChannelContext";

export async function spawnNotificationChannelTcpChildren(
  parent: ihsm.ParentActor<typeof CBNotificationChannelTop>,
  channel: CBNotificationChannelActorRef,
  socketPort: CBNotificationChannelPortConfig,
): Promise<CBNotificationChannelTcpChildren> {
  const readerCtx = createReaderContext(channel);
  const reader = spawnChildActor(parent, CBConnectionReaderTop, readerCtx, undefined, { initialize: false });
  reader.hsm.restore(ReaderUninitialized, readerCtx);
  const writerCtx = createWriterContext(channel);
  const writer = spawnChildActor(
    parent,
    CBConnectionWriterTop,
    writerCtx,
    new CBConnectionWriterPort(socketPort),
    { initialize: false },
  );
  writer.hsm.restore(WriterUninitialized, writerCtx);
  await reader.call.initialize();
  await writer.call.initialize();
  return { reader, writer };
}
