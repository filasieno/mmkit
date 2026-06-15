import type { ClientSettings, LanguageServerSettings, RawMmkitSettings, ServerSettings, } from "./types";

/** VS Code property-sheet defaults for the language server process. */
export const DEFAULT_LANGUAGE_SERVER: LanguageServerSettings = {
  trace: "off",
  lspPort: 16_011,
  httpPort: 28_080,
};

/** VS Code property-sheet defaults for internal cbserver launch. */
export const DEFAULT_SERVER: ServerSettings = {
  launchKind: "executable",
  executablePath: "cbserver",
  dockerImage: "conceptbase-cbserver:0.1.1",
  dockerContainerName: "mmkit-cbserver",
  dockerExtraRunArgs: [],
  dataDir: "~/.mmkit",
  port: 4001,
  updateMode: "persistent",
  databasePath: "",
  databaseAllPath: "",
  newDatabasePath: "",
  resetOnStart: false,
  tmpDir: "",
  loadDir: "",
  saveDir: "",
  viewsDir: "",
  devCommand: "",
  extraArgs: [],
};

/** VS Code property-sheet defaults for remote TCP client mode. */
export const DEFAULT_CLIENT: ClientSettings = {
  host: "127.0.0.1",
  port: 4001,
  toolName: "mmkit",
  userName: "user",
  connectTimeoutMs: 10_000,
  autoConnect: false,
  autoReconnect: true,
  reconnectBackoffMs: 2000,
};

/** Full property-sheet default snapshot (`mmkit.*` keys). */
export const DEFAULT_RAW: RawMmkitSettings = {
  operationalMode: "internalServer",
  traceLevel: "trace",
  languageServer: { ...DEFAULT_LANGUAGE_SERVER },
  server: { ...DEFAULT_SERVER },
  client: { ...DEFAULT_CLIENT },
};
