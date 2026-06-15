import * as ihsm from "ihsm/testing";
import { CbActorSpawnOptions } from "../../src/cbserver/shared/cbActorSpawnOptions";
import type { CBServerActorRef, LogReaderChildren } from "../../src/cbserver/actors/server/CBServerConfig";
import { StdoutLogReaderTop } from "../../src/cbserver/actors/stdoutLogReader/CBServerStdoutLogReaderActor";
import { StdoutLogReaderContext } from "../../src/cbserver/actors/stdoutLogReader/CBServerStdoutLogReaderContext";
import { StderrLogReaderTop } from "../../src/cbserver/actors/stderrLogReader/CBServerStderrReaderActor";
import { StderrReaderContext } from "../../src/cbserver/actors/stderrLogReader/CBServerStderrReaderContext";
import { CBConnectionTop } from "../../src/cbserver/actors/connection/CBServerConnectionConfig";
import type { CBConnectionActor } from "../../src/cbserver/actors/connection/CBServerConnectionConfig";
import type { CBConnectionContext } from "../../src/cbserver/actors/connection/CBServerConnectionContext";
import type { CBConnectionOrchestratorPort } from "../../src/cbserver/actors/connection/CBConnectionOrchestratorPort";
import { CBCommandChannelTop } from "../../src/cbserver/actors/commandChannel/CBCommandChannelConfig";
import type { CBCommandChannelActor, CBCommandChannelActorRef, CBCommandChannelPortConfig, CBCommandChannelPortInput } from "../../src/cbserver/actors/commandChannel/CBCommandChannelConfig";
import type { CBCommandChannelTcpChildren, ICBCommandChannelContext, } from "../../src/cbserver/actors/commandChannel/CBCommandChannelContext";
import { CBNotificationChannelTop } from "../../src/cbserver/actors/notificationChannel/CBNotificationChannelConfig";
import type { CBNotificationChannelActor, CBNotificationChannelActorRef, CBNotificationChannelPortConfig, CBNotificationChannelPortInput } from "../../src/cbserver/actors/notificationChannel/CBNotificationChannelConfig";
import type { CBNotificationChannelTcpChildren, ICBNotificationChannelContext, } from "../../src/cbserver/actors/notificationChannel/CBNotificationChannelContext";
import { CBConnectionReaderTop } from "../../src/cbserver/actors/reader/CBConnectionReaderActor";
import { CBConnectionReaderContext } from "../../src/cbserver/actors/reader/CBConnectionReaderContext";
import { CBConnectionWriterTop } from "../../src/cbserver/actors/writer/CBConnectionWriterActor";
import { CBConnectionWriterContext } from "../../src/cbserver/actors/writer/CBConnectionWriterContext";
import { CBConnectionWriterPort } from "../../src/cbserver/actors/writer/CBConnectionWriterPort";

const testSpawnOptions = new CbActorSpawnOptions();

export async function testSpawnLogReaderChildren(server: CBServerActorRef): Promise<LogReaderChildren> {
  const stdoutLogReader = ihsm.makeTestActor(StdoutLogReaderTop, new StdoutLogReaderContext(server), undefined, testSpawnOptions,);
  await stdoutLogReader.hsm.sync();
  await stdoutLogReader.call.initialize();

  const stderrLogReader = ihsm.makeTestActor(StderrLogReaderTop, new StderrReaderContext(server), undefined, testSpawnOptions,);
  await stderrLogReader.hsm.sync();
  await stderrLogReader.call.initialize();

  return { stdoutLogReader, stderrLogReader } as LogReaderChildren;
}

export async function testSpawnConnectionChild( context: CBConnectionContext, orchestratorPort: CBConnectionOrchestratorPort ): Promise<CBConnectionActor> {
  const child = ihsm.makeTestActor(CBConnectionTop, context, orchestratorPort, testSpawnOptions);
  await child.hsm.sync();
  await child.call.initialize();
  return child as CBConnectionActor;
}

export async function testSpawnCommandChannel( ctx: ICBCommandChannelContext, channelPort: CBCommandChannelPortInput ): Promise<CBCommandChannelActor> {
  const child = ihsm.makeTestActor(CBCommandChannelTop, ctx, channelPort, testSpawnOptions);
  await child.hsm.sync();
  await child.call.initialize();
  return child as CBCommandChannelActor;
}

export async function testSpawnNotificationChannel( ctx: ICBNotificationChannelContext, channelPort: CBNotificationChannelPortInput ): Promise<CBNotificationChannelActor> {
  const child = ihsm.makeTestActor(CBNotificationChannelTop, ctx, channelPort, testSpawnOptions);
  await child.hsm.sync();
  await child.call.initialize();
  return child as CBNotificationChannelActor;
}

export async function testSpawnCommandChannelTcpChildren( channel: CBCommandChannelActorRef, channelPort: CBCommandChannelPortConfig ): Promise<CBCommandChannelTcpChildren> {
  const reader = ihsm.makeTestActor(CBConnectionReaderTop, new CBConnectionReaderContext(channel), undefined, testSpawnOptions,);
  const writer = ihsm.makeTestActor(CBConnectionWriterTop, new CBConnectionWriterContext(channel), new CBConnectionWriterPort(channelPort), testSpawnOptions,);
  await reader.hsm.sync();
  await writer.hsm.sync();
  await reader.call.initialize();
  await writer.call.initialize();
  return { reader, writer };
}

export async function testSpawnNotificationChannelTcpChildren( channel: CBNotificationChannelActorRef, channelPort: CBNotificationChannelPortConfig ): Promise<CBNotificationChannelTcpChildren> {
  const reader = ihsm.makeTestActor(CBConnectionReaderTop, new CBConnectionReaderContext(channel), undefined, testSpawnOptions,);
  const writer = ihsm.makeTestActor(CBConnectionWriterTop, new CBConnectionWriterContext(channel), new CBConnectionWriterPort(channelPort), testSpawnOptions,);
  await reader.hsm.sync();
  await writer.hsm.sync();
  await reader.call.initialize();
  await writer.call.initialize();
  return { reader, writer };
}
