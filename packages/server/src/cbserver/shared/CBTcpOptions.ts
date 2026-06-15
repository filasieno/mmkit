/** TCP endpoint options for a {@link CBConnectionTop} session. */
export interface CBTcpConnectionOptions {
  host: string;
  port: number;
  toolName?: string;
  userName?: string;
  connectTimeoutMs?: number;
  socketTimeoutMs?: number;
}

/** Default TCP connect timeout for {@link CBConnectionPort}. */
export const DEFAULT_CB_TCP_CONNECT_MS = 2_000;

/** Default per-socket idle/command timeout for {@link CBConnectionPort}. */
export const DEFAULT_CB_TCP_SOCKET_MS = 8_000;
