import type { Uri } from "vscode";
import type { InstallProgressCallback } from "../install/progress";
import type {
  LaunchSpec,
  PanelInteraction,
  PanelViewModel,
  PortProbeResult,
  ProcessInfo,
  RawMmkitSettings,
  ResolvedPaths,
  TcpConnectResult,
  TcpSendResult,
} from "../types";

export interface VscodeConfigPort {
  readConfiguration(resource?: Uri): RawMmkitSettings;
  executeUpdate(patch: Record<string, unknown>, resource?: Uri): Promise<void>;
}

export interface FsPort {
  ensureDir(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
}

export interface AssetPort {
  getAssetRoot(): string;
  isInstallationComplete(paths: ResolvedPaths): Promise<boolean>;
  materialize(paths: ResolvedPaths, onProgress?: InstallProgressCallback): Promise<void>;
}

export interface UiPort {
  showInstallProgress(title: string): void;
  hideInstallProgress(): void;
  reportInstallProgress(message: string, percent: number): void;
}

export interface ProcessPort {
  spawn(spec: LaunchSpec): Promise<ProcessInfo>;
  kill(pid: number, signal?: NodeJS.Signals): Promise<void>;
  isRunning(pid: number): Promise<boolean>;
  onExit(pid: number, cb: (code: number | null, signal: NodeJS.Signals | null) => void): () => void;
}

export interface DockerPort {
  run(spec: LaunchSpec): Promise<ProcessInfo>;
  stop(containerName: string): Promise<void>;
  isRunning(containerName: string): Promise<boolean>;
  imageExists(image: string): Promise<boolean>;
  pullImage(image: string, onProgress?: (message: string, fractionWithinStep: number) => void): Promise<void>;
}

export interface NetworkPort {
  probe(host: string, port: number, timeoutMs: number): Promise<PortProbeResult>;
}

export interface TcpPort {
  connect(host: string, port: number, timeoutMs: number): Promise<TcpConnectResult>;
  send(socketId: string, method: string, data: string, client: string, serverName: string): Promise<TcpSendResult>;
  enroll(socketId: string, toolName: string, userName: string): Promise<TcpSendResult>;
  disconnect(socketId: string, client: string, serverName: string): Promise<TcpSendResult>;
  close(socketId: string): Promise<void>;
}

/** Sensor: host messages from webview. Actuator: render ViewModel. */
export interface PanelPort {
  render(viewModel: PanelViewModel): Promise<void>;
  onInteraction(handler: (interaction: PanelInteraction) => void): () => void;
  isVisible(): boolean;
}

export interface MmkitPorts {
  vscodeConfig: VscodeConfigPort;
  fs: FsPort;
  assets: AssetPort;
  ui: UiPort;
  process: ProcessPort;
  docker: DockerPort;
  network: NetworkPort;
  tcp: TcpPort;
  panel: PanelPort;
}
