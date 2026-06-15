import * as ihsm from "ihsm/testing";
import {
  buildIpcMessage,
  encodeCbString,
  parseAnswerTerm,
  toCbAnswer,
} from "@mmkit/shared/dist/cb-tcp";
import { CBCommandChannelTop } from "../../src/cbserver/actors/commandChannel/CBCommandChannelConfig";
import type { CBCommandChannelActorRef } from "../../src/cbserver/actors/commandChannel/CBCommandChannelConfig";
import { CBNotificationChannelTop } from "../../src/cbserver/actors/notificationChannel/CBNotificationChannelConfig";
import type { CBNotificationChannelActorRef } from "../../src/cbserver/actors/notificationChannel/CBNotificationChannelConfig";
import { formatTcpLengthFrame } from "../../src/cbserver/actors/reader/tcpFraming";
import { CB_IPC_METHODS } from "../../src/cbserver/shared/cbIpcCatalog";
import { createReaderContext, CBConnectionReaderTop, ReaderUninitialized } from "../../src/cbserver/actors/reader/CBConnectionReaderActor";
import { createWriterContext, CBConnectionWriterTop, WriterUninitialized } from "../../src/cbserver/actors/writer/CBConnectionWriterActor";
import { CBConnectionWriterPort } from "../../src/cbserver/actors/writer/CBConnectionWriterPort";
import type { CBCommandChannelTcpChildren } from "../../src/cbserver/actors/commandChannel/CBCommandChannelContext";
import type { CBNotificationChannelTcpChildren } from "../../src/cbserver/actors/notificationChannel/CBNotificationChannelContext";
import { spawnTestChildActor } from "./cbChildSpawnTest";

@ihsm.mock("open", "write", "destroy", "spawnTcpChildren")
export abstract class MockCBCommandChannelPort extends ihsm.TestPort<typeof CBCommandChannelTop> {
  abstract open(): Promise<void>;
  abstract write(buffer: Buffer): Promise<void>;
  abstract destroy(): void;
  abstract spawnTcpChildren(
    channel: CBCommandChannelActorRef,
  ): Promise<CBCommandChannelTcpChildren>;
}

@ihsm.mock("open", "write", "destroy", "spawnTcpChildren")
export abstract class MockCBNotificationChannelPort extends ihsm.TestPort<typeof CBNotificationChannelTop> {
  abstract open(): Promise<void>;
  abstract write(buffer: Buffer): Promise<void>;
  abstract destroy(): void;
  abstract spawnTcpChildren(
    channel: CBNotificationChannelActorRef,
  ): Promise<CBNotificationChannelTcpChildren>;
}

function parseOutboundMethod(buffer: Buffer): string | undefined {
  const text = buffer.toString("utf8");
  const body = text.startsWith("X") ? text.slice(5) : text;
  const match = body.match(/ipcmessage\([^,]+,[^,]+,(\w+),/);
  return match?.[1];
}

function mockAnswerBody(method: string | undefined, enrollClientId: string): string {
  if (method === CB_IPC_METHODS.ENROLL_ME) {
    return `ipcanswer("cbserver",ok,${encodeCbString(enrollClientId)}).`;
  }
  if (method === CB_IPC_METHODS.CANCEL_ME) {
    return `ipcanswer("cbserver",ok,"yes").`;
  }
  if (method === CB_IPC_METHODS.GET_MODULE_PATH) {
    return `ipcanswer("cbserver",ok,${encodeCbString("/Root")}).`;
  }
  if (method === CB_IPC_METHODS.REPORT_CLIENTS) {
    return `ipcanswer("cbserver",ok,${encodeCbString("[]")}).`;
  }
  return `ipcanswer("cbserver",ok,"yes").`;
}

function wireMockCommandTcpSocket(
  port: ReturnType<typeof ihsm.makeTestPort<MockCBCommandChannelPort>>,
  enrollClientId: string,
): void {
  port.open.default(async () => undefined);
  port.destroy.default(() => undefined);
  port.write.default(async (buffer: Buffer) => {
    const method = parseOutboundMethod(buffer);
    const body = mockAnswerBody(method, enrollClientId);
    port.send("onSocketData", formatTcpLengthFrame(body));
  });
  port.spawnTcpChildren.default(async (channel) => {
    const readerCtx = createReaderContext(channel);
    const reader = spawnTestChildActor(CBConnectionReaderTop, readerCtx, undefined, { initialize: false });
    reader.hsm.restore(ReaderUninitialized, readerCtx);
    const writerCtx = createWriterContext(channel);
    const writer = spawnTestChildActor(
      CBConnectionWriterTop,
      writerCtx,
      new CBConnectionWriterPort(port),
      { initialize: false },
    );
    writer.hsm.restore(WriterUninitialized, writerCtx);
    await reader.call.initialize();
    await writer.call.initialize();
    return { reader, writer };
  });
}

function wireMockNotificationTcpSocket(
  port: ReturnType<typeof ihsm.makeTestPort<MockCBNotificationChannelPort>>,
  enrollClientId: string,
): void {
  port.open.default(async () => undefined);
  port.destroy.default(() => undefined);
  port.write.default(async (buffer: Buffer) => {
    const method = parseOutboundMethod(buffer);
    const body = mockAnswerBody(method, enrollClientId);
    port.send("onSocketData", formatTcpLengthFrame(body));
  });
  port.spawnTcpChildren.default(async (channel) => {
    const readerCtx = createReaderContext(channel);
    const reader = spawnTestChildActor(CBConnectionReaderTop, readerCtx, undefined, { initialize: false });
    reader.hsm.restore(ReaderUninitialized, readerCtx);
    const writerCtx = createWriterContext(channel);
    const writer = spawnTestChildActor(
      CBConnectionWriterTop,
      writerCtx,
      new CBConnectionWriterPort(port),
      { initialize: false },
    );
    writer.hsm.restore(WriterUninitialized, writerCtx);
    await reader.call.initialize();
    await writer.call.initialize();
    return { reader, writer };
  });
}

export function makeMockCommandChannelPort(
  enrollClientId = "mock-client",
): ReturnType<typeof ihsm.makeTestPort<MockCBCommandChannelPort>> {
  const port = ihsm.makeTestPort(MockCBCommandChannelPort);
  wireMockCommandTcpSocket(port, enrollClientId);
  return port;
}

export function makeMockNotificationChannelPort(
  enrollClientId = "mock-notify-client",
): ReturnType<typeof ihsm.makeTestPort<MockCBNotificationChannelPort>> {
  const port = ihsm.makeTestPort(MockCBNotificationChannelPort);
  wireMockNotificationTcpSocket(port, enrollClientId);
  return port;
}

/** @deprecated Use {@link makeMockCommandChannelPort} */
export function makeMockTcpSocketPort(enrollClientId = "mock-client") {
  return makeMockCommandChannelPort(enrollClientId);
}

export function formatMockIpcAnswer(method: string, result = "yes"): string {
  const message = buildIpcMessage('""', '"cbserver"', method, "");
  void message;
  const term = `ipcanswer("cbserver",ok,${encodeCbString(result)}).`;
  void toCbAnswer(parseAnswerTerm(term));
  return formatTcpLengthFrame(term);
}

/** @deprecated Use {@link MockCBCommandChannelPort} */
export abstract class MockCBChannelPort extends MockCBCommandChannelPort {}

/** @deprecated Use {@link MockCBCommandChannelPort} */
export abstract class MockCBConnectionPort extends MockCBCommandChannelPort {}
