import * as ihsm from "ihsm/testing";
import { encodeCbString } from "@mmkit/base";
import type { CBCommandChannelTop, CBCommandChannelActorRef } from "../../src/cbserver/actors/commandChannel/CBCommandChannelConfig";
import type { CBNotificationChannelTop, CBNotificationChannelActorRef } from "../../src/cbserver/actors/notificationChannel/CBNotificationChannelConfig";
import { formatTcpLengthFrame } from "../../src/cbserver/actors/reader/tcpFraming";
import type { CBCommandChannelTcpChildren } from "../../src/cbserver/actors/commandChannel/CBCommandChannelContext";
import type { CBNotificationChannelTcpChildren } from "../../src/cbserver/actors/notificationChannel/CBNotificationChannelContext";
import { testSpawnCommandChannelTcpChildren, testSpawnNotificationChannelTcpChildren } from "./cbserverTestSpawn";
import {
  createMockCbserverSession,
  mockCbserverAnswer,
  takePendingNotification,
  type MockCbserverSession,
} from "./mockCbserverResponder";

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

export type MockChannelPair = {
  command: ReturnType<typeof ihsm.makeTestPort<MockCBCommandChannelPort>>;
  notification: ReturnType<typeof ihsm.makeTestPort<MockCBNotificationChannelPort>>;
  session: MockCbserverSession;
};

function wireChannelPort<
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
>(
  port: TPort,
  session: MockCbserverSession,
  onAnswered: (() => void) | undefined,
  spawnTcpChildren: (
    channel: CBCommandChannelActorRef | CBNotificationChannelActorRef,
  ) => Promise<CBCommandChannelTcpChildren | CBNotificationChannelTcpChildren>,
): void {
  port.open.default(async () => undefined);
  port.destroy.default(() => undefined);
  port.write.default(async (buffer: Buffer) => {
    port.send("onSocketData", formatTcpLengthFrame(mockCbserverAnswer(session, buffer)));
    onAnswered?.();
  });
  port.spawnTcpChildren.default(async (channel) => spawnTcpChildren(channel));
}

/** Dual-channel mock ports sharing one in-memory cbserver session. */
export function makeMockChannelPair(cmdClientId: string, notifClientId: string): MockChannelPair {
  const session = createMockCbserverSession(cmdClientId);
  const notifSession = createMockCbserverSession(notifClientId);
  const command = ihsm.makeTestPort(MockCBCommandChannelPort);
  const notification = ihsm.makeTestPort(MockCBNotificationChannelPort);

  session.notificationSink = {
    push(frame: string) {
      setImmediate(() => notification.send("onSocketData", frame));
    },
  };

  const flushPending = (): void => {
    const pending = takePendingNotification(session);
    if (pending !== undefined) {
      setImmediate(() => notification.send("onSocketData", pending));
    }
  };

  wireChannelPort(
    command,
    session,
    flushPending,
    (channel) => testSpawnCommandChannelTcpChildren(channel as CBCommandChannelActorRef, command),
  );

  wireChannelPort(
    notification,
    notifSession,
    undefined,
    (channel) => testSpawnNotificationChannelTcpChildren(channel as CBNotificationChannelActorRef, notification),
  );

  return { command, notification, session };
}

export function makeMockCommandChannelPort(enrollClientId = "mock-client") {
  return makeMockChannelPair(enrollClientId, `${enrollClientId}-notify`).command;
}

export function makeMockNotificationChannelPort(enrollClientId = "mock-notify-client") {
  return makeMockChannelPair(`${enrollClientId}-cmd`, enrollClientId).notification;
}

export function formatMockIpcAnswer(_method: string, result = "yes"): string {
  const term = `ipcanswer("cbserver",ok,${encodeCbString(result)}).`;
  return formatTcpLengthFrame(term);
}
