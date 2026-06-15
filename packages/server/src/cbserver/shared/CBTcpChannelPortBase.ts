import type * as net from "node:net";
import * as ihsm from "ihsm";
import { DEFAULT_CB_TCP_CONNECT_MS, DEFAULT_CB_TCP_SOCKET_MS } from "./CBTcpOptions";
import type { CBTcpConnectionOptions } from "./CBTcpOptions";
import { connectTcpSocket } from "./CbTcpSocketSubscription";
import type { CbTcpSocketNotify, CbTcpSocketSubscription } from "./CbTcpSocketSubscription";

/** Shared TCP socket open/write/destroy for command and notification channel ports. */
export abstract class CBTcpChannelPortBase<T extends ihsm.TopStateArg> extends ihsm.Port<T> {
  private socket?: net.Socket;
  private socketSubscription?: CbTcpSocketSubscription;
  private readonly connectTimeoutMs: number;
  private readonly socketTimeoutMs: number;

  constructor(protected readonly tcpOptions: CBTcpConnectionOptions) {
    super();
    this.connectTimeoutMs = tcpOptions.connectTimeoutMs ?? DEFAULT_CB_TCP_CONNECT_MS;
    this.socketTimeoutMs = tcpOptions.socketTimeoutMs ?? DEFAULT_CB_TCP_SOCKET_MS;
  }

  async open(): Promise<void> {
    if (this.socket !== undefined) {
      return;
    }
    const inbound: ihsm.InboundActor<ihsm.ActorConfigOf<T>> | ihsm.ChildActor<ihsm.ActorConfigOf<T>> | undefined =
      this.actor;
    if (inbound === undefined) {
      throw new Error(`${this.constructor.name}.open requires a port bound to an actor`);
    }
    const { host, port }: { host: string; port: number } = this.tcpOptions;
    const connected: { socket: net.Socket; subscription: CbTcpSocketSubscription } = await connectTcpSocket( { host, port, connectTimeoutMs: this.connectTimeoutMs, socketTimeoutMs: this.socketTimeoutMs, notify: inbound.notify as CbTcpSocketNotify, } );
    this.socket = connected.socket;
    this.socketSubscription = connected.subscription;
  }

  async write(buffer: Buffer): Promise<void> {
    const socket: net.Socket | undefined = this.socket;
    if (socket === undefined) {
      throw new Error("socket is not open");
    }
    await new Promise<void>( (resolve, reject) => { socket.write(buffer, (err) => { if (err) { reject(err); return; } resolve(); }); } );
  }

  destroy(): void {
    this.socketSubscription?.dispose();
    this.socketSubscription = undefined;
    this.socket?.destroy();
    this.socket = undefined;
  }
}
