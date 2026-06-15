import * as net from "node:net";
import { buildEnrollPayload, buildIpcMessage, encodeCbString, lengthPrefix, parseAnswerTerm } from "../../protocol/cb-tcp";
import type { TcpConnectResult, TcpSendResult } from "../../types";
import type { TcpPort } from "../types";

interface LiveSocket {
  socket: net.Socket;
  buffer: string;
}

export class RealTcpPort implements TcpPort {
  private readonly sockets = new Map<string, LiveSocket>();
  private nextId = 1;

  connect(host: string, port: number, timeoutMs: number): Promise<TcpConnectResult> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      const id = `tcp-${this.nextId++}`;
      const fail = (error: string) => {
        socket.destroy();
        resolve({ ok: false, error });
      };
      socket.setTimeout(timeoutMs);
      socket.once("timeout", () => fail("connect timeout"));
      socket.once("error", (err) => fail(String(err)));
      socket.connect(port, host, () => {
        this.sockets.set(id, { socket, buffer: "" });
        resolve({ ok: true, socketId: id });
      });
    });
  }

  async enroll(socketId: string, toolName: string, userName: string): Promise<TcpSendResult> {
    const payload = buildEnrollPayload(toolName, userName);
    return this.send(socketId, "ENROLL_ME", payload, '""', '""');
  }

  async send(socketId: string, method: string, data: string, client: string, serverName: string): Promise<TcpSendResult> {
    const live = this.sockets.get(socketId);
    if (!live) return { ok: false, error: "unknown socket" };

    const message = buildIpcMessage(client, serverName, method, data);
    const frame = lengthPrefix(message);

    return new Promise((resolve) => {
      live.socket.write(frame, async (err) => {
        if (err) {
          resolve({ ok: false, error: String(err), completion: "broken" });
          return;
        }
        try {
          const answer = await this.readAnswer(live);
          resolve({
            ok: answer.completion === "ok",
            completion: answer.completion,
            sender: answer.sender,
            returnData: answer.returnData,
          });
        } catch (e) {
          resolve({ ok: false, error: String(e), completion: "broken" });
        }
      });
    });
  }

  async disconnect(socketId: string, client: string, serverName: string): Promise<TcpSendResult> {
    const result = await this.send(socketId, "CANCEL_ME", "", client, serverName);
    await this.close(socketId);
    return result;
  }

  async close(socketId: string): Promise<void> {
    const live = this.sockets.get(socketId);
    if (!live) return;
    live.socket.destroy();
    this.sockets.delete(socketId);
  }

  private readAnswer(live: LiveSocket): Promise<ReturnType<typeof parseAnswerTerm>> {
    return new Promise((resolve, reject) => {
      const onData = (chunk: Buffer) => {
        live.buffer += chunk.toString("utf8");
        const newline = live.buffer.indexOf("\n");
        if (newline < 0) return;
        const len = Number.parseInt(live.buffer.slice(0, newline), 10);
        const bodyStart = newline + 1;
        if (live.buffer.length < bodyStart + len) return;
        const body = live.buffer.slice(bodyStart, bodyStart + len);
        live.buffer = live.buffer.slice(bodyStart + len);
        live.socket.off("data", onData);
        resolve(parseAnswerTerm(body));
      };
      live.socket.on("data", onData);
      live.socket.once("error", reject);
      live.socket.once("timeout", () => reject(new Error("read timeout")));
    });
  }
}

export function enrolledClientName(toolName: string): string {
  return encodeCbString(toolName);
}
