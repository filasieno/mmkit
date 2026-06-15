import * as ihsm from "ihsm/testing";
import { buildIpcMessage, encodeCbString, parseAnswerTerm, toCbAnswer, } from "@mmkit/base";
import type { CBCommandChannelTop, CBCommandChannelActorRef } from "../../src/cbserver/actors/commandChannel/CBCommandChannelConfig";
import type { CBNotificationChannelTop, CBNotificationChannelActorRef } from "../../src/cbserver/actors/notificationChannel/CBNotificationChannelConfig";
import { formatTcpLengthFrame } from "../../src/cbserver/actors/reader/tcpFraming";
import { CB_IPC_METHODS } from "../../src/cbserver/shared/cbIpcCatalog";
import type { CBCommandChannelTcpChildren } from "../../src/cbserver/actors/commandChannel/CBCommandChannelContext";
import type { CBNotificationChannelTcpChildren } from "../../src/cbserver/actors/notificationChannel/CBNotificationChannelContext";
import { testSpawnCommandChannelTcpChildren, testSpawnNotificationChannelTcpChildren } from "./cbserverTestSpawn";

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

function wireMockTcpSocket<
  TPort extends {
    open: { default: (fn: () => Promise<void>) => void };
    destroy: { default: (fn: () => void) => void };
    write: { default: (fn: (buffer: Buffer) => Promise<void>) => void };
    send: (event: "onSocketData", frame: string) => void;
    spawnTcpChildren: {
      default: (
        fn: (channel: CBCommandChannelActorRef | CBNotificationChannelActorRef) => Promise<
          CBCommandChannelTcpChildren | CBNotificationChannelTcpChildren
        >,
      ) => void;
    };
  },
>( port: TPort, enrollClientId: string, spawnTcpChildren: ( channel: CBCommandChannelActorRef | CBNotificationChannelActorRef, ) => Promise<CBCommandChannelTcpChildren | CBNotificationChannelTcpChildren> ): void {
  port.open.default(async () => undefined);
  port.destroy.default(() => undefined);
  port.write.default( async (buffer: Buffer) => { const method = parseOutboundMethod(buffer); const body = mockAnswerBody(method, enrollClientId); port.send("onSocketData", formatTcpLengthFrame(body)); } );
  port.spawnTcpChildren.default(async (channel) => spawnTcpChildren(channel));
}

export function makeMockCommandChannelPort(enrollClientId = "mock-client",): ReturnType<typeof ihsm.makeTestPort<MockCBCommandChannelPort>> {
  const port = ihsm.makeTestPort(MockCBCommandChannelPort);
  wireMockTcpSocket( port, enrollClientId, (channel) => testSpawnCommandChannelTcpChildren(channel as CBCommandChannelActorRef, port), );
  return port;
}

export function makeMockNotificationChannelPort(enrollClientId = "mock-notify-client",): ReturnType<typeof ihsm.makeTestPort<MockCBNotificationChannelPort>> {
  const port = ihsm.makeTestPort(MockCBNotificationChannelPort);
  wireMockTcpSocket( port, enrollClientId, (channel) => testSpawnNotificationChannelTcpChildren(channel as CBNotificationChannelActorRef, port), );
  return port;
}

export function formatMockIpcAnswer(method: string, result = "yes"): string {
  const message = buildIpcMessage('""', '"cbserver"', method, "");
  void message;
  const term = `ipcanswer("cbserver",ok,${encodeCbString(result)}).`;
  void toCbAnswer(parseAnswerTerm(term));
  return formatTcpLengthFrame(term);
}
