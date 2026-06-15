/**
 * Port-bound mock cbserver — answers IPC at the TCP mock boundary so actor state
 * machines see the same request/response shape as a real cbserver.
 */
import { decodeCbString, encodeCbString } from "@mmkit/base";
import { CB_IPC_METHODS } from "../../src/cbserver/shared/cbIpcCatalog";
import { formatTcpLengthFrame } from "../../src/cbserver/actors/reader/tcpFraming";

export type MockNotificationSink = {
  push(frame: string): void;
};

export type MockCbserverSession = {
  enrollClientId: string;
  modulePath: string;
  notificationSink?: MockNotificationSink;
  pendingNotifications: string[];
  /** Real cbserver exits on STOP_SERVER — mock port triggers supervisor onProcessExit. */
  onStopServer?: () => void;
};

export function createMockCbserverSession(enrollClientId: string): MockCbserverSession {
  return {
    enrollClientId,
    modulePath: "/Root",
    pendingNotifications: [],
  };
}

function parseOutboundIpc(buffer: Buffer): { method: string; data: string } | undefined {
  const text = buffer.toString("utf8");
  const body = text.startsWith("X") ? text.slice(5) : text;
  const match = body.match(/ipcmessage\([^,]+,[^,]+,(\w+),\[(.*)\]\)\./s);
  if (match === null) {
    return undefined;
  }
  return { method: match[1]!, data: match[2] ?? "" };
}

function decodeFirstCbString(data: string): string | undefined {
  const trimmed = data.trim();
  if (trimmed === "") {
    return undefined;
  }
  return decodeCbString(trimmed);
}

function stripModuleQuotes(modulePath: string): string {
  const decoded = decodeCbString(modulePath) ?? modulePath;
  return decoded.replace(/^'/, "").replace(/'$/, "").replace(/'\//g, "/").replace(/'-/g, "-");
}

function answerTerm(result: string, completion = "ok"): string {
  return `ipcanswer("cbserver",${completion},${encodeCbString(result)}).`;
}

function pushNotification(session: MockCbserverSession, about: string): void {
  const frame = formatTcpLengthFrame(answerTerm(about, "notification"));
  if (session.notificationSink !== undefined) {
    session.notificationSink.push(frame);
    return;
  }
  session.pendingNotifications.push(frame);
}

export function mockCbserverAnswer(session: MockCbserverSession, buffer: Buffer): string {
  const ipc = parseOutboundIpc(buffer);
  const method = ipc?.method;
  const data = ipc?.data ?? "";

  if (method === CB_IPC_METHODS.ENROLL_ME) {
    return answerTerm(session.enrollClientId);
  }
  if (method === CB_IPC_METHODS.CANCEL_ME) {
    return answerTerm("yes");
  }
  if (method === CB_IPC_METHODS.GET_MODULE_PATH) {
    return answerTerm(session.modulePath);
  }
  if (method === CB_IPC_METHODS.SET_MODULE_CONTEXT) {
    const mod = decodeFirstCbString(data);
    if (mod !== undefined) {
      session.modulePath = stripModuleQuotes(mod);
    }
    return answerTerm("yes");
  }
  if (method === CB_IPC_METHODS.GET_MODULE_CONTEXT) {
    return answerTerm(session.modulePath);
  }
  if (method === CB_IPC_METHODS.REPORT_CLIENTS) {
    return answerTerm("[]");
  }
  if (method === CB_IPC_METHODS.NEXT_MESSAGE) {
    return answerTerm("empty_queue");
  }
  if (method === CB_IPC_METHODS.LPI_CALL) {
    const goal = decodeFirstCbString(data) ?? data;
    if (goal.includes("PROLOG_CALL,true") || goal === "PROLOG_CALL,true") {
      return answerTerm("true");
    }
    if (goal.includes("getModulePath")) {
      return answerTerm(session.modulePath);
    }
    return answerTerm("yes");
  }
  if (method === CB_IPC_METHODS.ASK) {
    return answerTerm("yes");
  }
  if (method === CB_IPC_METHODS.NOTIFICATION_REQUEST) {
    const aboutMatch = data.match(/^([^,]+),/);
    const aboutRaw = aboutMatch?.[1] ?? "";
    const about = decodeCbString(aboutRaw.trim()) ?? aboutRaw;
    if (about.startsWith("delete(")) {
      return answerTerm("yes");
    }
    if (about.startsWith("view(")) {
      pushNotification(session, about);
    }
    return answerTerm("yes");
  }
  if (method === CB_IPC_METHODS.STOP_SERVER) {
    session.onStopServer?.();
    return answerTerm("yes");
  }

  return answerTerm("yes");
}

export function takePendingNotification(session: MockCbserverSession): string | undefined {
  return session.pendingNotifications.shift();
}
