import * as net from "node:net";
import * as os from "node:os";
import {
  buildEnrollPayload,
  buildIpcMessage,
  encodeCbString,
  lengthPrefix,
  parseAnswerTerm,
  toCbAnswer,
  type AskFormat,
  type CbAnswer,
} from "@mmkit/shared";

export interface CbTcpClientOptions {
  host: string;
  port: number;
  toolName?: string;
  userName?: string;
  connectTimeoutMs?: number;
  socketTimeoutMs?: number;
}

export class CbTcpClient {
  private socket?: net.Socket;
  private buffer = "";
  private clientId = '""';
  private serverId = '"cbserver"';
  private connected = false;
  private readonly toolName: string;
  private readonly userName: string;
  private readonly connectTimeoutMs: number;
  private readonly socketTimeoutMs: number;

  constructor(private readonly options: CbTcpClientOptions) {
    this.toolName = options.toolName ?? "mmkit-mcp";
    this.userName = options.userName ?? "mmkit";
    this.connectTimeoutMs = options.connectTimeoutMs ?? 10_000;
    this.socketTimeoutMs = options.socketTimeoutMs ?? 120_000;
  }

  get isConnected(): boolean {
    return this.connected;
  }

  get host(): string {
    return this.options.host;
  }

  get port(): number {
    return this.options.port;
  }

  get clientName(): string {
    return this.clientId;
  }

  get serverName(): string {
    return this.serverId;
  }

  async connect(): Promise<CbAnswer> {
    if (this.connected) {
      return { completion: "ok", ok: true, result: this.clientId };
    }
    await this.openSocket();
    const userSuffix = `${this.userName}@${os.hostname()}_${os.arch()}_${os.platform().replace(/\s/g, "")}`;
    const payload = buildEnrollPayload(this.toolName, userSuffix);
    const answer = await this.sendMessage("ENROLL_ME", payload, '""', '""');
    if (answer.ok) {
      this.connected = true;
      if (answer.respondingTool) {
        this.serverId = answer.respondingTool;
      }
      if (answer.result) {
        this.clientId = encodeCbString(answer.result);
      }
    }
    return answer;
  }

  async disconnect(): Promise<CbAnswer> {
    if (!this.connected || !this.socket) {
      return { completion: "ok", ok: true };
    }
    const answer = await this.sendMessage("CANCEL_ME", "", this.clientId, this.serverId);
    this.connected = false;
    this.socket.destroy();
    this.socket = undefined;
    return answer;
  }

  async tell(frames: string): Promise<CbAnswer> {
    return this.sendMessage("TELL", encodeCbString(frames));
  }

  async tellTransactions(transactions: string): Promise<CbAnswer> {
    const parts = transactions.split(/\{---\}/);
    let merged: CbAnswer | undefined;
    for (const part of parts) {
      const ans = await this.tell(part);
      merged = ans;
      if (!ans.ok) return ans;
    }
    return merged ?? { completion: "ok", ok: true };
  }

  async untell(frames: string): Promise<CbAnswer> {
    return this.sendMessage("UNTELL", encodeCbString(frames));
  }

  async tellModel(files: string[]): Promise<CbAnswer> {
    const encoded = `[${files.map((f) => encodeCbString(f)).join(",")}]`;
    return this.sendMessage("TELL_MODEL", encoded);
  }

  async retell(untellFrames: string, tellFrames: string): Promise<CbAnswer> {
    const payload = `[${encodeCbString(untellFrames)},${encodeCbString(tellFrames)}]`;
    return this.sendMessage("RETELL", payload);
  }

  async ask(
    query: string,
    queryFormat: AskFormat | string = "OBJNAMES",
    answerRep = "LABEL",
    rollbackTime = "Now"
  ): Promise<CbAnswer> {
    const payload = `${queryFormat},${encodeCbString(query)},${encodeCbString(answerRep)},${encodeCbString(rollbackTime)}`;
    return this.sendMessage("ASK", payload);
  }

  async askFrames(query: string, answerRep = "LABEL", rollbackTime = "Now"): Promise<CbAnswer> {
    return this.ask(query, "FRAMES", answerRep, rollbackTime);
  }

  async askObjNames(query: string, answerRep = "LABEL", rollbackTime = "Now"): Promise<CbAnswer> {
    return this.ask(query, "OBJNAMES", answerRep, rollbackTime);
  }

  async hypoAsk(
    frames: string,
    query: string,
    queryFormat: AskFormat | string,
    answerRep: string,
    rollbackTime: string
  ): Promise<CbAnswer> {
    const payload = `${encodeCbString(frames)},${queryFormat},${encodeCbString(query)},${encodeCbString(answerRep)},${encodeCbString(rollbackTime)}`;
    return this.sendMessage("HYPO_ASK", payload);
  }

  async getObject(objname: string): Promise<string> {
    const ans = await this.ask(`get_object[${objname}/objname]`, "OBJNAMES", "FRAME", "Now");
    return ans.ok ? (ans.result ?? "error") : "error";
  }

  async findInstances(objname: string): Promise<string> {
    const ans = await this.ask(`find_instances[${objname}/class]`, "OBJNAMES", "LABEL", "Now");
    return ans.ok ? (ans.result ?? "error") : "error";
  }

  async stopServer(): Promise<CbAnswer> {
    const ans = await this.sendMessage("STOP_SERVER", "");
    if (ans.ok) {
      this.connected = false;
      this.socket?.destroy();
      this.socket = undefined;
    }
    return ans;
  }

  async lpiCall(lpicall: string): Promise<CbAnswer> {
    return this.sendMessage("LPI_CALL", encodeCbString(lpicall));
  }

  async nextMessage(messageType: string): Promise<CbAnswer> {
    return this.sendMessage("NEXT_MESSAGE", messageType);
  }

  async setModule(modulePath: string): Promise<CbAnswer> {
    return this.sendMessage("SET_MODULE_CONTEXT", encodeCbString(quoteModuleNames(modulePath)));
  }

  async getModule(): Promise<string | undefined> {
    const ans = await this.sendMessage("GET_MODULE_CONTEXT", "");
    return ans.result;
  }

  async getModulePath(): Promise<CbAnswer> {
    return this.sendMessage("GET_MODULE_PATH", "");
  }

  async listModule(module: string): Promise<string | undefined> {
    const ans = await this.ask(`listModule[${module}/module]`, "OBJNAMES", "FRAME", "Now");
    return ans.ok ? ans.result : undefined;
  }

  async notificationRequest(about: string, tool?: string): Promise<CbAnswer> {
    const target = tool ?? this.clientId;
    return this.sendMessage("NOTIFICATION_REQUEST", `${encodeCbString(about)},${target}`);
  }

  async disconnectSimple(): Promise<string> {
    const ans = await this.disconnect();
    return ans.ok ? "yes" : "no";
  }

  async tells(frames: string): Promise<string> {
    const ans = await this.tell(frames);
    return ans.ok ? "yes" : (ans.result ?? "no");
  }

  async untells(frames: string): Promise<string> {
    const ans = await this.untell(frames);
    return ans.ok ? "yes" : (ans.result ?? "no");
  }

  async asks(query: string, format?: string): Promise<string> {
    const ans = format
      ? await this.ask(query, "OBJNAMES", format, "Now")
      : await this.ask(query, "OBJNAMES", "LABEL", "Now");
    return ans.ok ? (ans.result ?? "no") : "no";
  }

  async pwd(): Promise<string> {
    const ans = await this.getModulePath();
    return ans.ok ? (ans.result ?? "no") : "no";
  }

  async cd(newModule: string): Promise<string> {
    const ans = await this.setModule(newModule);
    return ans.ok ? "yes" : "no";
  }

  async mkdir(newModule: string): Promise<string> {
    const ans = await this.tell(`:MOD-CB-NAME ${newModule}\n:MOD-CB-TYPE SubModule.`);
    return ans.ok ? "yes" : "no";
  }

  private async openSocket(): Promise<void> {
    if (this.socket) return;
    const { host, port } = this.options;
    this.socket = await new Promise<net.Socket>((resolve, reject) => {
      const socket = new net.Socket();
      socket.setTimeout(this.socketTimeoutMs);
      socket.once("timeout", () => {
        socket.destroy();
        reject(new Error("connect timeout"));
      });
      socket.once("error", reject);
      socket.connect(port, host, () => {
        socket.setTimeout(this.socketTimeoutMs);
        resolve(socket);
      });
    });
  }

  private async sendMessage(
    method: string,
    data: string,
    client = this.clientId,
    server = this.serverId
  ): Promise<CbAnswer> {
    if (!this.socket) {
      return { completion: "broken", ok: false, result: "not connected" };
    }
    const message = buildIpcMessage(client, server, method, data);
    const frame = lengthPrefix(message);
    return new Promise((resolve) => {
      this.socket!.write(frame, async (err) => {
        if (err) {
          resolve({ completion: "broken", ok: false, result: String(err) });
          return;
        }
        try {
          const parsed = await this.readAnswer();
          resolve(toCbAnswer(parsed));
        } catch (e) {
          resolve({ completion: "broken", ok: false, result: String(e) });
        }
      });
    });
  }

  private readAnswer(): Promise<ReturnType<typeof parseAnswerTerm>> {
    return new Promise((resolve, reject) => {
      const socket = this.socket;
      if (!socket) {
        reject(new Error("no socket"));
        return;
      }
      const onData = (chunk: Buffer) => {
        this.buffer += chunk.toString("utf8");
        const newline = this.buffer.indexOf("\n");
        if (newline < 0) return;
        const len = Number.parseInt(this.buffer.slice(0, newline), 10);
        const bodyStart = newline + 1;
        if (this.buffer.length < bodyStart + len) return;
        const body = this.buffer.slice(bodyStart, bodyStart + len);
        this.buffer = this.buffer.slice(bodyStart + len);
        socket.off("data", onData);
        resolve(parseAnswerTerm(body));
      };
      socket.on("data", onData);
      socket.once("error", reject);
      socket.once("timeout", () => reject(new Error("read timeout")));
    });
  }
}

function quoteModuleNames(modulePath: string): string {
  if (/(.*)-[0-9](.*)/.test(modulePath)) {
    return `'${modulePath.replaceAll("-", "'-'")}'`;
  }
  if (/(.*)\/[0-9](.*)/.test(modulePath)) {
    return `'${modulePath.replaceAll("/", "'/'")}'`;
  }
  return modulePath;
}
