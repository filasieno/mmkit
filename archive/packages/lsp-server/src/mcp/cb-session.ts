import type { ServerSupervisor } from "../cbserver/supervisor/server-supervisor";
import { CbTcpClient } from "./cb-tcp-client";

export interface CbConnectParams {
  host?: string;
  port?: number;
  toolName?: string;
  userName?: string;
}

export class CbMcpSession {
  private client?: CbTcpClient;

  constructor(private readonly supervisor: ServerSupervisor) {}

  async getClient(params: CbConnectParams = {}): Promise<CbTcpClient> {
    const state = this.supervisor.getState();
    const host = params.host ?? "127.0.0.1";
    const port = params.port ?? state.port;
    if (!port) {
      throw new Error("mmkit server is not running (no port)");
    }
    if (!this.client || this.client.host !== host || this.client.port !== port) {
      this.client = new CbTcpClient({
        host,
        port,
        toolName: params.toolName,
        userName: params.userName,
      });
    }
    if (!this.client.isConnected) {
      const answer = await this.client.connect();
      if (!answer.ok) {
        throw new Error(answer.result ?? "ENROLL_ME failed");
      }
    }
    return this.client;
  }

  async disconnect(): Promise<void> {
    if (this.client?.isConnected) {
      await this.client.disconnect();
    }
    this.client = undefined;
  }
}
