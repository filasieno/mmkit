import type { ChangeClass, ClientSettings, OperationalMode, RawMmkitSettings, ServerSettings } from "../types";

export interface FieldMeta {
  key: string;
  title: string;
  description: string;
  type: "string" | "boolean" | "number" | "array";
  default: unknown;
  enum?: string[];
  scope?: "resource" | "application";
  changeClass: ChangeClass;
  category: "general" | "server" | "client";
}

export const DEFAULT_SERVER: ServerSettings = {
  autoStartup: true,
  launchKind: "executable",
  executablePath: "",
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
  traceMode: "",
  untellMode: "",
  cacheMode: "",
  cacheSize: "",
  optimizerMode: "",
  viewsMaintenance: "",
  restartDelaySeconds: "",
  securityLevel: "",
  maxErrors: "",
  adminUser: "",
  multiUser: false,
  moduleSeparator: "",
  moduleGeneration: "",
  ccMode: "",
  maxCost: "",
  pathLength: "",
  iterMax: "",
  ecaMode: "",
  ecaOptimizer: "",
  ruleLabels: "",
  inactivityHours: "",
  serverMode: "",
  stratificationMode: "",
  devCommand: "",
  extraArgs: [],
};

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

export const DEFAULT_RAW: RawMmkitSettings = {
  operationalMode: "internalServer",
  traceLevel: "trace",
  server: { ...DEFAULT_SERVER },
  client: { ...DEFAULT_CLIENT },
};

const serverField = (
  key: keyof ServerSettings,
  title: string,
  description: string,
  type: FieldMeta["type"],
  defaultValue: unknown,
  changeClass: ChangeClass,
  extra?: Partial<FieldMeta>
): FieldMeta => ({
  key: `mmkit.server.${key}`,
  title,
  description,
  type,
  default: defaultValue,
  changeClass,
  category: "server",
  ...extra,
});

/** User-facing settings only — install-tree paths are provided by the Docker image. */
export const FIELD_REGISTRY: FieldMeta[] = [
  {
    key: "mmkit.operationalMode",
    title: "Operational mode",
    description: "Whether mmkit manages a local cbserver, connects as a TCP client, or stays idle.",
    type: "string",
    default: "internalServer",
    enum: ["none", "internalServer", "client"],
    changeClass: "cold",
    category: "general",
  },
  {
    key: "mmkit.traceLevel",
    title: "Trace level",
    description: "Minimum OTEL severity for MMKit Trace output and ihsm state-machine tracing.",
    type: "string",
    default: "trace",
    enum: ["trace", "debug", "info", "warn", "error", "off"],
    changeClass: "hot",
    category: "general",
  },
  serverField("autoStartup", "Auto-start server", "Start the internal cbserver automatically when configuration is valid.", "boolean", true, "hot"),
  serverField("launchKind", "Launch method", "Run cbserver as a local binary or inside Docker.", "string", "executable", "cold", {
    enum: ["executable", "docker"],
  }),
  serverField("executablePath", "cbserver executable path", "Path to the cbserver binary.", "string", "cbserver", "warm"),
  serverField("dockerImage", "Docker image", "Container image reference for Docker launch.", "string", "conceptbase-cbserver:0.1.1", "warm"),
  serverField("dockerContainerName", "Docker container name", "Fixed name for the cbserver container.", "string", "mmkit-cbserver", "warm"),
  serverField("dockerExtraRunArgs", "Extra Docker run arguments", "Additional docker run arguments.", "array", [], "warm"),
  serverField("dataDir", "Data directory", "Base directory for mmkit-owned cbserver data (~/.mmkit).", "string", "~/.mmkit", "warm", {
    scope: "application",
  }),
  serverField("port", "TCP port", "Port cbserver listens on.", "number", 4001, "warm"),
  serverField("updateMode", "Update mode", "persistent or nonpersistent database updates.", "string", "persistent", "warm"),
  serverField("databasePath", "Database directory (-d)", "Persistent database directory.", "string", "", "warm"),
  serverField("databaseAllPath", "Workspace database (-db)", "Combined database workspace path (default: dataDir/workspace).", "string", "", "warm"),
  serverField("newDatabasePath", "New database (-new)", "Create a new database at this path on start.", "string", "", "warm"),
  serverField("resetOnStart", "Reset database on start", "Use -new instead of -d for databasePath.", "boolean", false, "warm"),
  serverField("tmpDir", "Temporary directory", "TMPDIR for nonpersistent session copies (default: dataDir/tmp).", "string", "", "warm"),
  serverField("loadDir", "Load directory", "Module load directory (-load, default: dataDir/load).", "string", "", "warm"),
  serverField("saveDir", "Save directory", "Module save directory (-save).", "string", "", "warm"),
  serverField("viewsDir", "Views directory", "Materialized views directory (-views).", "string", "", "warm"),
  serverField("traceMode", "Trace mode", "Diagnostic trace level (-t).", "string", "", "hot"),
  serverField("untellMode", "Untell mode", "Untell behaviour (-U).", "string", "", "warm"),
  serverField("cacheMode", "Cache mode", "Query cache mode (-c).", "string", "", "warm"),
  serverField("cacheSize", "Cache size", "Query cache size (-cs).", "string", "", "warm"),
  serverField("optimizerMode", "Optimizer mode", "Optimizer mode (-o).", "string", "", "warm"),
  serverField("viewsMaintenance", "Views maintenance", "View maintenance mode (-v).", "string", "", "warm"),
  serverField("restartDelaySeconds", "Restart delay", "Auto-restart delay after crash (-r).", "string", "", "warm"),
  serverField("securityLevel", "Security level", "Security level (-s).", "string", "", "warm"),
  serverField("maxErrors", "Max errors", "Maximum errors before stop.", "string", "", "warm"),
  serverField("adminUser", "Admin user", "Administrator user name.", "string", "", "warm"),
  serverField("multiUser", "Multi-user mode", "Enable multi-user access.", "boolean", false, "warm"),
  serverField("moduleSeparator", "Module separator", "Module separator character.", "string", "", "warm"),
  serverField("moduleGeneration", "Module generation", "Module generation mode.", "string", "", "warm"),
  serverField("ccMode", "CC mode", "ConceptBase compatibility mode.", "string", "", "warm"),
  serverField("maxCost", "Max cost", "Maximum query cost.", "string", "", "warm"),
  serverField("pathLength", "Path length", "Maximum path length.", "string", "", "warm"),
  serverField("iterMax", "Iteration max", "Maximum iterations.", "string", "", "warm"),
  serverField("ecaMode", "ECA mode", "ECA rule mode.", "string", "", "warm"),
  serverField("ecaOptimizer", "ECA optimizer", "ECA optimizer setting.", "string", "", "warm"),
  serverField("ruleLabels", "Rule labels", "Rule label configuration.", "string", "", "warm"),
  serverField("inactivityHours", "Inactivity hours", "Shutdown after inactivity hours.", "string", "", "warm"),
  serverField("serverMode", "Server mode", "cbserver operating mode.", "string", "", "warm"),
  serverField("stratificationMode", "Stratification mode", "Stratification mode.", "string", "", "warm"),
  serverField("devCommand", "Dev command", "Override launch command for development.", "string", "", "cold"),
  serverField("extraArgs", "Extra arguments", "Additional cbserver CLI arguments.", "array", [], "warm"),
  {
    key: "mmkit.client.host",
    title: "Server host",
    description: "Hostname or IP of the remote cbserver.",
    type: "string",
    default: "127.0.0.1",
    changeClass: "warm",
    category: "client",
  },
  {
    key: "mmkit.client.port",
    title: "Server port",
    description: "TCP port of the remote cbserver.",
    type: "number",
    default: 4001,
    changeClass: "warm",
    category: "client",
  },
  {
    key: "mmkit.client.toolName",
    title: "Client tool name",
    description: "Tool name sent during ENROLL_ME.",
    type: "string",
    default: "mmkit",
    changeClass: "warm",
    category: "client",
  },
  {
    key: "mmkit.client.userName",
    title: "User name",
    description: "User name sent during ENROLL_ME.",
    type: "string",
    default: "user",
    changeClass: "warm",
    category: "client",
  },
  {
    key: "mmkit.client.connectTimeoutMs",
    title: "Connect timeout (ms)",
    description: "TCP connect and enroll timeout.",
    type: "number",
    default: 10_000,
    changeClass: "warm",
    category: "client",
  },
  {
    key: "mmkit.client.autoConnect",
    title: "Auto-connect",
    description: "Connect automatically when operational mode is client.",
    type: "boolean",
    default: false,
    changeClass: "hot",
    category: "client",
  },
  {
    key: "mmkit.client.autoReconnect",
    title: "Auto-reconnect",
    description: "Reconnect after connection loss.",
    type: "boolean",
    default: true,
    changeClass: "hot",
    category: "client",
  },
  {
    key: "mmkit.client.reconnectBackoffMs",
    title: "Reconnect backoff (ms)",
    description: "Delay before reconnect attempts.",
    type: "number",
    default: 2000,
    changeClass: "warm",
    category: "client",
  },
];

export function parseOperationalMode(value: unknown): OperationalMode {
  if (value === "internalServer" || value === "client" || value === "none") {
    return value;
  }
  return "internalServer";
}
