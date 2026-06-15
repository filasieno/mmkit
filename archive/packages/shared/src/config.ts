import type { InstallStep } from "./constants";

export type OperationalMode = "none" | "internalServer" | "client";
export type LaunchKind = "executable" | "docker";
export type OtelTraceLevel = "trace" | "debug" | "info" | "warn" | "error" | "off";

export interface ValidationError {
  field: string;
  message: string;
}

export interface ServerSettings {
  autoStartup: boolean;
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
  traceMode: string;
  untellMode: string;
  cacheMode: string;
  cacheSize: string;
  optimizerMode: string;
  viewsMaintenance: string;
  restartDelaySeconds: string;
  securityLevel: string;
  maxErrors: string;
  adminUser: string;
  multiUser: boolean;
  moduleSeparator: string;
  moduleGeneration: string;
  ccMode: string;
  maxCost: string;
  pathLength: string;
  iterMax: string;
  ecaMode: string;
  ecaOptimizer: string;
  ruleLabels: string;
  inactivityHours: string;
  serverMode: string;
  stratificationMode: string;
  devCommand: string;
  extraArgs: string[];
}

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

export interface ResolvedPaths {
  dataDir: string;
  databaseAllPath: string;
  tmpDir: string;
  loadDir: string;
  databasePath: string;
  newDatabasePath: string;
  saveDir: string;
  viewsDir: string;
  installMarker: string;
}

/** Serializable config snapshot for LSP/MCP RPC (no VS Code Uri). */
export interface ConfigSnapshotPayload {
  generation: number;
  operationalMode: OperationalMode;
  traceLevel: OtelTraceLevel;
  server: ServerSettings;
  client: ClientSettings;
  paths: ResolvedPaths;
  valid: boolean;
  errors: ValidationError[];
}

export interface LaunchSpec {
  kind: LaunchKind;
  command: string;
  args: string[];
  env: Record<string, string>;
  cwd?: string;
}

export interface ProcessInfo {
  pid: number;
  command: string;
}

export interface PortProbeResult {
  reachable: boolean;
  latencyMs?: number;
  error?: string;
}

export interface InstallProgressEvent {
  step: InstallStep;
  message: string;
  percent: number;
}
