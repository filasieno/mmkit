import type { Uri } from "vscode";
import type { InstallStep } from "./constants";

export type OperationalMode = "none" | "internalServer" | "client";
export type LaunchKind = "executable" | "docker";
export type ChangeClass = "hot" | "warm" | "cold";
/** OTEL-aligned minimum severity for MMKit Trace output and ihsm tracing. */
export type OtelTraceLevel = "trace" | "debug" | "info" | "warn" | "error" | "off";

export interface ValidationError {
  field: string;
  message: string;
}

export interface FaultInfo {
  actorId: string;
  message: string;
  cause?: unknown;
}

export type ShutdownReason = "deactivate" | "modeSwitch" | "watchdog";

export interface RawMmkitSettings {
  operationalMode: OperationalMode;
  traceLevel: OtelTraceLevel;
  server: ServerSettings;
  client: ClientSettings;
}

export type PanelInteractionKind = "click" | "keydown";

export interface PanelInteraction {
  kind: PanelInteractionKind;
  actionId: string;
  key?: string;
}

export interface PanelActionViewModel {
  id: string;
  label: string;
  enabled: boolean;
  variant?: "primary" | "secondary" | "danger";
}

/** Pure data for the React panel — no behaviour. */
export interface PanelViewModel {
  title: string;
  operationalMode: OperationalMode;
  serverState: string;
  clientState: string;
  snapshotValid: boolean;
  port: number;
  host: string;
  traceLevel: OtelTraceLevel;
  actions: PanelActionViewModel[];
  statusMessage: string;
}

/** User-configurable server settings (install paths live in the Docker image or assets). */
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

export interface ConfigSnapshot {
  generation: number;
  resource?: Uri;
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

export interface TcpConnectResult {
  ok: boolean;
  socketId?: string;
  error?: string;
}

export interface TcpSendResult {
  ok: boolean;
  completion?: "ok" | "error" | "not_handled" | "notification" | "timeout" | "broken";
  sender?: string;
  returnData?: string;
  error?: string;
}

export interface InstallProgressEvent {
  step: InstallStep;
  message: string;
  percent: number;
}
