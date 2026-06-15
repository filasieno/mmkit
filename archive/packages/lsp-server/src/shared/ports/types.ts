import type { LaunchSpec, PortProbeResult, ProcessInfo, ResolvedPaths } from "@mmkit/shared";

export type InstallProgressCallback = (message: string, fractionWithinStep: number) => void;

export interface FsPort {
  ensureDir(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
}

export interface AssetPort {
  getAssetRoot(): string;
  isInstallationComplete(paths: ResolvedPaths): Promise<boolean>;
  materialize(paths: ResolvedPaths, onProgress?: InstallProgressCallback): Promise<void>;
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

export interface MmkitServerPorts {
  fs: FsPort;
  assets: AssetPort;
  process: ProcessPort;
  docker: DockerPort;
  network: NetworkPort;
}
