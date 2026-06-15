import * as net from "node:net";
import type { ICBServerNetworkSettings } from "./settings/CBServerSettings";
import { DEFAULT_CB_SERVER_NETWORK } from "./settings/CBServerSettings";

export type TcpConnectProbeOptions = {
  host: string;
  port: number;
  connectTimeoutMs: number;
};

export type TcpListenProbeOptions = TcpConnectProbeOptions & {
  maxAttempts?: number;
  intervalMs?: number;
};

export type TcpPortProbeSchedule = {
  maxAttempts: number;
  intervalMs: number;
  connectTimeoutMs: number;
};

function readPositiveInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === "") {
    return fallback;
  }
  const value: number = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/** Resolve probe retry budget from config with optional env overrides. */
export function resolveTcpPortProbeSchedule(network: Pick<ICBServerNetworkSettings, "portProbeMaxAttempts" | "portProbeIntervalMs" | "portProbeConnectTimeoutMs">): TcpPortProbeSchedule {
  return {
    maxAttempts: readPositiveInt(process.env.MMKIT_PORT_PROBE_ATTEMPTS, network.portProbeMaxAttempts),
    intervalMs: readPositiveInt(process.env.MMKIT_PORT_PROBE_INTERVAL_MS, network.portProbeIntervalMs),
    connectTimeoutMs: readPositiveInt(process.env.MMKIT_PORT_PROBE_TIMEOUT_MS, network.portProbeConnectTimeoutMs),
  };
}

/** Returns true when a TCP connect to host:port succeeds (cbserver is accepting clients). */
export function probeTcpConnect(options: TcpConnectProbeOptions): Promise<boolean> {
  const { host, port, connectTimeoutMs } = options;
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
    if (await probeTcpConnect({ host, port, connectTimeoutMs })) {
      return;
    }
    if (attempt + 1 < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }
  throw new Error(`TCP port not reachable on ${host}:${port}`);
}
