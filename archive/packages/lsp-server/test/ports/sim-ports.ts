import { EventEmitter } from "node:events";
import * as path from "node:path";
import type { LaunchSpec, PortProbeResult, ProcessInfo, ResolvedPaths } from "@mmkit/shared";
import type { AssetPort, DockerPort, FsPort, MmkitServerPorts, NetworkPort, ProcessPort } from "../../src/shared/ports/types";

export class SimAssetPort implements AssetPort {
  installedMarkers = new Set<string>();
  materializeCalls = 0;

  getAssetRoot(): string {
    return path.join(__dirname, "..", "..", "..", "..", "packages", "extension", "assets", "cbserver");
  }

  async isInstallationComplete(paths: ResolvedPaths): Promise<boolean> {
    return this.installedMarkers.has(paths.installMarker);
  }

  async materialize(paths: ResolvedPaths, onProgress?: (message: string, fraction: number) => void): Promise<void> {
    this.materializeCalls += 1;
    onProgress?.("Simulated asset materialize", 1);
    this.installedMarkers.add(paths.installMarker);
  }
}

export class SimFsPort implements FsPort {
  readonly dirs = new Set<string>();

  async ensureDir(dirPath: string): Promise<void> {
    this.dirs.add(dirPath);
  }

  async exists(dirPath: string): Promise<boolean> {
    return this.dirs.has(dirPath);
  }
}

interface SimProcess {
  pid: number;
  emitter: EventEmitter;
}

export class SimProcessPort implements ProcessPort {
  private readonly processes = new Map<number, SimProcess>();
  private nextPid = 4000;
  network?: SimNetworkPort;
  startupDelayMs = 50;
  private startupTimer?: ReturnType<typeof setTimeout>;

  private armStartupTimer(): void {
    if (this.startupTimer !== undefined) clearTimeout(this.startupTimer);
    if (!this.network) return;
    this.network.reachable = false;
    this.startupTimer = setTimeout(() => {
      this.startupTimer = undefined;
      if (this.network) this.network.reachable = true;
    }, this.startupDelayMs);
  }

  async spawn(spec: LaunchSpec): Promise<ProcessInfo> {
    const pid = this.nextPid++;
    const emitter = new EventEmitter();
    this.processes.set(pid, { pid, emitter });
    this.armStartupTimer();
    return { pid, command: spec.command };
  }

  async kill(pid: number): Promise<void> {
    if (this.startupTimer !== undefined) clearTimeout(this.startupTimer);
    if (this.network) this.network.reachable = false;
    this.processes.delete(pid);
  }

  async isRunning(pid: number): Promise<boolean> {
    return this.processes.has(pid);
  }

  get spawnCount(): number {
    return this.processes.size;
  }

  onExit(pid: number, cb: (code: number | null, signal: NodeJS.Signals | null) => void): () => void {
    const proc = this.processes.get(pid);
    if (!proc) return () => undefined;
    proc.emitter.on("exit", cb);
    return () => proc.emitter.off("exit", cb);
  }
}

export class SimDockerPort implements DockerPort {
  readonly running = new Set<string>();
  startupDelayMs = 50;
  network?: SimNetworkPort;
  private startupTimer?: ReturnType<typeof setTimeout>;

  private armStartupTimer(): void {
    if (this.startupTimer !== undefined) clearTimeout(this.startupTimer);
    if (!this.network) return;
    this.network.reachable = false;
    this.startupTimer = setTimeout(() => {
      this.startupTimer = undefined;
      if (this.network) this.network.reachable = true;
    }, this.startupDelayMs);
  }

  async run(_spec: LaunchSpec): Promise<ProcessInfo> {
    const name = _spec.args[_spec.args.indexOf("--name") + 1] ?? "mmkit-cbserver";
    if (this.startupDelayMs > 0) {
      await new Promise((r) => setTimeout(r, this.startupDelayMs));
    }
    this.running.add(name);
    this.armStartupTimer();
    return { pid: 1, command: "docker" };
  }

  async stop(containerName: string): Promise<void> {
    if (this.startupTimer !== undefined) clearTimeout(this.startupTimer);
    if (this.network) this.network.reachable = false;
    this.running.delete(containerName);
  }

  async isRunning(containerName: string): Promise<boolean> {
    return this.running.has(containerName);
  }

  async imageExists(_image: string): Promise<boolean> {
    return true;
  }

  async pullImage(_image: string, onProgress?: (message: string, fraction: number) => void): Promise<void> {
    onProgress?.("pull complete", 1);
  }
}

export class SimNetworkPort implements NetworkPort {
  reachable = true;

  async probe(_host: string, _port: number, _timeoutMs: number): Promise<PortProbeResult> {
    return { reachable: this.reachable };
  }
}

export interface SimPortsBundle {
  ports: MmkitServerPorts;
  sim: {
    assets: SimAssetPort;
    docker: SimDockerPort;
    network: SimNetworkPort;
    process: SimProcessPort;
    fs: SimFsPort;
  };
}

export function createSimPorts(): SimPortsBundle {
  const assets = new SimAssetPort();
  const docker = new SimDockerPort();
  const network = new SimNetworkPort();
  const process = new SimProcessPort();
  const fs = new SimFsPort();
  docker.network = network;
  process.network = network;
  return {
    ports: { assets, docker, network, process, fs },
    sim: { assets, docker, network, process, fs },
  };
}
