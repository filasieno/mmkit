import type { MmkitTraceWriter } from "../logging/trace";
import { buildAskPayload, CONNECTION_TEST_ASK_QUERY, isExistsClassYes } from "../protocol/cb-ask";
import { encodeCbString } from "../protocol/cb-tcp";
import type { MmkitPorts } from "../ports/types";

export interface ConnectionTestOptions {
  ports: MmkitPorts;
  host: string;
  port: number;
  toolName: string;
  userName: string;
  connectTimeoutMs: number;
  trace?: MmkitTraceWriter;
}

export interface ConnectionTestResult {
  ok: boolean;
  message: string;
  query: string;
  reply?: string;
  error?: string;
}

export async function runConnectionTest(options: ConnectionTestOptions): Promise<ConnectionTestResult> {
  const { ports, host, port, toolName, userName, connectTimeoutMs, trace } = options;
  const query = CONNECTION_TEST_ASK_QUERY;

  trace?.info("connection test starting", { host, port, query });

  const connect = await ports.tcp.connect(host, port, connectTimeoutMs);
  if (!connect.ok || !connect.socketId) {
    const message = connect.error ?? "TCP connect failed";
    trace?.error("connection test connect failed", { host, port, error: message });
    return { ok: false, message, query, error: message };
  }

  const socketId = connect.socketId;
  let clientName = encodeCbString(toolName);
  let serverName = '"cbserver"';
  try {
    const enroll = await ports.tcp.enroll(socketId, toolName, userName);
    if (!enroll.ok || enroll.completion !== "ok") {
      const message = enroll.error ?? "ENROLL_ME failed";
      trace?.error("connection test enroll failed", { error: message, completion: enroll.completion });
      return { ok: false, message, query, error: message };
    }

    serverName = enroll.sender ?? serverName;
    clientName = encodeCbString(enroll.returnData ?? toolName);
    const askPayload = buildAskPayload(query);
    trace?.info("connection test ASK", { askPayload, client: clientName, serverName });

    const ask = await ports.tcp.send(socketId, "ASK", askPayload, clientName, serverName);
    trace?.info("connection test ASK reply", {
      completion: ask.completion,
      reply: ask.returnData,
    });

    if (!ask.ok || ask.completion !== "ok") {
      const message = ask.error ?? `ASK failed (${ask.completion ?? "unknown"})`;
      return { ok: false, message, query, reply: ask.returnData, error: message };
    }

    if (!isExistsClassYes(ask.returnData)) {
      const message = `unexpected ASK reply (expected yes for Class): ${ask.returnData ?? "(empty)"}`;
      return { ok: false, message, query, reply: ask.returnData, error: message };
    }

    const message = `ASK ${query} → ${ask.returnData}`;
    trace?.info("connection test succeeded", { reply: ask.returnData });
    return { ok: true, message, query, reply: ask.returnData };
  } finally {
    try {
      await ports.tcp.disconnect(socketId, clientName, serverName);
    } catch {
      await ports.tcp.close(socketId);
    }
  }
}
