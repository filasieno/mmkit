import * as net from "node:net";
import { DEFAULT_CB_SERVER_NETWORK } from "./settings/CBServerSettings";

export type TcpListenProbeOptions = {
  host: string;
  port: number;
  maxAttempts?: number;
  intervalMs?: number;
  connectTimeoutMs?: number;
};

/** Returns true when a TCP connect to host:port succeeds (cbserver is accepting clients). */
export function probeTcpPort(
  host: string,
  port: number,
  connectTimeoutMs = DEFAULT_CB_SERVER_NETWORK.portProbeConnectTimeoutMs,
): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const finish = (reachable: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(reachable);
    };
    socket.setTimeout(connectTimeoutMs);
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
    socket.connect(port, host, () => finish(true));
  });
}

/** Poll until the TCP port accepts connections or the attempt budget is exhausted. */
export async function awaitTcpListen(options: TcpListenProbeOptions): Promise<void> {
  const {
    host,
    port,
    maxAttempts = DEFAULT_CB_SERVER_NETWORK.portProbeMaxAttempts,
    intervalMs = DEFAULT_CB_SERVER_NETWORK.portProbeIntervalMs,
    connectTimeoutMs = DEFAULT_CB_SERVER_NETWORK.portProbeConnectTimeoutMs,
  } = options;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (await probeTcpPort(host, port, connectTimeoutMs)) {
      return;
    }
    if (attempt + 1 < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }
  throw new Error(`TCP port not reachable on ${host}:${port}`);
}
