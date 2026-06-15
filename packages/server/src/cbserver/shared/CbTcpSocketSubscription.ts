import * as net from "node:net";
import type * as ihsm from "ihsm";

/** TCP socket notifications shared by command and notification channel actors. */
export interface CbTcpSocketNotify {
  onSocketData(chunk: string): void;
  onSocketEnd(): void;
  onSocketClose(hadError: boolean): void;
  onSocketError(errorMessage: string): void;
  onSocketTimeout(): void;
}

export type CbTcpConnectOptions = {
  host: string;
  port: number;
  connectTimeoutMs: number;
  socketTimeoutMs: number;
  notify: CbTcpSocketNotify;
};

/**
 * Wires a connected {@link net.Socket} to ihsm notifications in the constructor.
 * Listeners are registered before the connect promise resolves so no post-connect
 * event can arrive unhandled.
 */
export class CbTcpSocketSubscription implements ihsm.Disposable {
  private disposed = false;

  constructor( private readonly socket: net.Socket, notify: CbTcpSocketNotify ) {
    socket.on( "data", (chunk: Buffer) => { notify.onSocketData(chunk.toString("utf8")); } );
    socket.once( "end", () => { notify.onSocketEnd(); } );
    socket.once( "close", (hadError: boolean) => { notify.onSocketClose(hadError); } );
    socket.on( "error", (err) => { notify.onSocketError(String(err)); } );
    socket.on( "timeout", () => { notify.onSocketTimeout(); } );
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.socket.removeAllListeners();
  }
}

/** Opens a TCP client socket and attaches {@link CbTcpSocketSubscription} in the connect callback. */
export function connectTcpSocket(options: CbTcpConnectOptions,): Promise<{ socket: net.Socket; subscription: CbTcpSocketSubscription }> {
  const {
    host,
    port,
    connectTimeoutMs,
    socketTimeoutMs,
    notify,
  }: {
    host: string;
    port: number;
    connectTimeoutMs: number;
    socketTimeoutMs: number;
    notify: CbTcpSocketNotify;
  } = options;
  return new Promise( (resolve, reject) => { const socket: net.Socket = new net.Socket(); const failConnect: (err: Error) => void = (err: Error) => { socket.removeAllListeners(); socket.destroy(); reject(err); }; socket.setTimeout(connectTimeoutMs); socket.once("timeout", () => failConnect(new Error("connect timeout"))); socket.once("error", failConnect); socket.connect(port, host, () => { const subscription: CbTcpSocketSubscription = new CbTcpSocketSubscription(socket, notify); if (socketTimeoutMs > 0) { socket.setTimeout(socketTimeoutMs); } resolve({ socket, subscription }); }); } );
}
