/**
 * Extension-only types mirroring VS Code `mmkit.*` workspace settings.
 *
 * User-facing labels, tooltips, and `package.json` contributes metadata live in
 * {@link ./field-registry.ts}. Runtime contracts are {@link @mmkit/base} interfaces.
 */

/** How mmkit relates to a cbserver instance (VS Code `mmkit.operationalMode`). */
export type OperationalMode = "none" | "internalServer" | "client";

/** Local binary vs container launch (VS Code `mmkit.server.launchKind`). */
export type LaunchKind = "executable" | "docker";

/**
 * Config change classification for ConfigActor hot/warm/cold handling.
 * Extension metadata only — not part of {@link @mmkit/base} runtime contracts.
 */
export type ChangeClass = "hot" | "warm" | "cold";

/** OTEL-aligned minimum severity for MMKit Trace output (`mmkit.traceLevel`). */
export type OtelTraceLevel = "trace" | "debug" | "info" | "warn" | "error" | "off";

export interface LanguageServerSettings {
  trace: "off" | "messages" | "verbose";
  lspPort: number;
  httpPort: number;
}

/** cbserver launch and data paths from the Server settings category. */
export interface ServerSettings {
  launchKind: LaunchKind;
  executablePath: string;
  dockerImage: string;
  dockerContainerName: string;
  dockerExtraRunArgs: string[];
  dataDir: string;
  port: number;
  updateMode: string;
  databasePath: string;
  databaseAllPath: string;
  newDatabasePath: string;
  resetOnStart: boolean;
  tmpDir: string;
  loadDir: string;
  saveDir: string;
  viewsDir: string;
  devCommand: string;
  extraArgs: string[];
}

/** Remote TCP client settings from the Client settings category. */
export interface ClientSettings {
  host: string;
  port: number;
  toolName: string;
  userName: string;
  connectTimeoutMs: number;
  autoConnect: boolean;
  autoReconnect: boolean;
  reconnectBackoffMs: number;
}

/** Snapshot of all `mmkit.*` workspace settings before mapping to {@link @mmkit/base}. */
export interface RawMmkitSettings {
  operationalMode: OperationalMode;
  traceLevel: OtelTraceLevel;
  languageServer: LanguageServerSettings;
  server: ServerSettings;
  client: ClientSettings;
}
