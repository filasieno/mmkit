import * as net from "node:net";
import * as ihsm from "ihsm";
import type { CBNotificationChannelPortConfig } from "./CBNotificationChannelConfig";
import { CBNotificationChannelTop, type CBNotificationChannelPortHandle, type CBNotificationChannelMachineConfig } from "./CBNotificationChannelConfig";
import type { CBTcpConnectionOptions } from "../../shared/CBTcpOptions";
import { DEFAULT_CB_TCP_CONNECT_MS, DEFAULT_CB_TCP_SOCKET_MS } from "../../shared/CBTcpOptions";
import type { CBNotificationChannelActorRef } from "./CBNotificationChannelConfig";
import { spawnNotificationChannelTcpChildren } from "./spawnNotificationChannelTcpChildren";

/** Socket `write` surface used by the writer child port. */
export type CBNotificationChannelSocketWrite = Pick<CBNotificationChannelPortConfig, "write">;

type NotificationInbound = ihsm.InboundActor<CBNotificationChannelMachineConfig>;

/** Production port — TCP socket I/O for the notification channel. */
export class CBNotificationChannelPort extends ihsm.Port<typeof CBNotificationChannelTop> {
  private socket?: net.Socket;
  private readonly connectTimeoutMs: number;
  private readonly socketTimeoutMs: number;

  constructor(private readonly options: CBTcpConnectionOptions) {
    super();
    this.connectTimeoutMs = options.connectTimeoutMs ?? DEFAULT_CB_TCP_CONNECT_MS;
    this.socketTimeoutMs = options.socketTimeoutMs ?? DEFAULT_CB_TCP_SOCKET_MS;
  }

  async open(): Promise<void> {
    if (this.socket !== undefined) {
      return;
    }
    const { host, port } = this.options;
    const inbound = this.actor;
    this.socket = await new Promise<net.Socket>((resolve, reject) => {
      const socket = new net.Socket();
      const onError = (err: Error) => {
        socket.removeAllListeners();
        socket.destroy();
        reject(err);
      };
      socket.setTimeout(this.connectTimeoutMs);
      socket.once("timeout", () => onError(new Error("connect timeout")));
      socket.once("error", onError);
      socket.connect(port, host, () => {
        if (this.socketTimeoutMs > 0) {
          socket.setTimeout(this.socketTimeoutMs);
        }
        resolve(socket);
      });
    });

    this.bindTcpSocket(this.socket, inbound);
    inbound.notify.onSocketConnect();
  }

  private bindTcpSocket(socket: net.Socket, inbound: NotificationInbound): void {
    socket.on("data", (chunk: Buffer) => {
      inbound.notify.onSocketData(chunk.toString("utf8"));
    });
    socket.on("drain", () => {
      inbound.notify.onSocketDrain();
    });
    socket.once("end", () => {
      inbound.notify.onSocketEnd();
    });
    socket.once("close", (hadError: boolean) => {
      inbound.notify.onSocketClose(hadError);
    });
    socket.on("error", (err) => {
      inbound.notify.onSocketError(String(err));
    });
    socket.on("timeout", () => {
      inbound.notify.onSocketTimeout();
    });
  }

  async write(buffer: Buffer): Promise<void> {
    const socket = this.socket;
    if (socket === undefined) {
      throw new Error("socket is not open");
    }
    await new Promise<void>((resolve, reject) => {
      socket.write(buffer, (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  destroy(): void {
    this.socket?.removeAllListeners();
    this.socket?.destroy();
    this.socket = undefined;
  }

  async spawnTcpChildren(channel: CBNotificationChannelActorRef) {
    return spawnNotificationChannelTcpChildren(
      channel as never as ihsm.ParentActor<typeof CBNotificationChannelTop>,
      channel,
      this,
    );
  }
}
