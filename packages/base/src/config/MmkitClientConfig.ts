/**
 * Remote TCP client identity and connection behaviour when
 * {@link IMmkitOperationalConfig.operationalMode} is `client`.
 *
 * Mapped from VS Code `mmkit.client.*` settings and used during ENROLL_ME.
 */
export interface IMmkitClientConfig {
  /**
   * Hostname or IP of the remote cbserver.
   * @default `127.0.0.1`
   */
  host: string;

  /**
   * TCP port of the remote cbserver (`2000`–`65535`).
   * @default 4001
   */
  port: number;

  /**
   * Tool name sent in the ENROLL_ME IPC handshake.
   * @default `mmkit`
   */
  toolName: string;

  /**
   * User name sent in the ENROLL_ME IPC handshake.
   * @default `user`
   */
  userName: string;

  /**
   * TCP connect and enroll timeout in milliseconds.
   * @default 10000
   */
  connectTimeoutMs: number;

  /**
   * Connect automatically when operational mode becomes `client`.
   * @default false
   */
  autoConnect: boolean;

  /**
   * Reconnect after an unexpected connection loss.
   * @default true
   */
  autoReconnect: boolean;

  /**
   * Delay before each reconnect attempt in milliseconds.
   * @default 2000
   */
  reconnectBackoffMs: number;
}

export const DEFAULT_MMKIT_CLIENT: IMmkitClientConfig = {
  host: "127.0.0.1",
  port: 4001,
  toolName: "mmkit",
  userName: "user",
  connectTimeoutMs: 10_000,
  autoConnect: false,
  autoReconnect: true,
  reconnectBackoffMs: 2000,
};
