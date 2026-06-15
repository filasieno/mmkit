import type { LaunchSpec, PortProbeResult, ProcessInfo, ResolvedPaths } from "@mmkit/shared";
import type { InstallProgressCallback, MmkitServerPorts } from "../../src/shared/ports/types";
import { createSimPorts } from "../ports/sim-ports";
import { applyFault, type FaultRegistry } from "./fault-injection";

export function createFaultableServerPorts(faults: FaultRegistry) {
  const base = createSimPorts();

  const ports: MmkitServerPorts = {
    fs: {
      ensureDir: (dir) => applyFault(faults, "fs.ensureDir", () => base.ports.fs.ensureDir(dir)),
      exists: (dir) => applyFault(faults, "fs.exists", () => base.ports.fs.exists(dir)),
    },
    assets: {
      getAssetRoot: () => base.ports.assets.getAssetRoot(),
      isInstallationComplete: (paths) =>
        applyFault(faults, "assets.isInstallationComplete", () => base.ports.assets.isInstallationComplete(paths)),
      materialize: (paths: ResolvedPaths, onProgress?: InstallProgressCallback) =>
        applyFault(faults, "assets.materialize", () => base.ports.assets.materialize(paths, onProgress)),
    },
    process: {
      spawn: (spec: LaunchSpec) => applyFault(faults, "process.spawn", () => base.ports.process.spawn(spec)),
      kill: (pid: number, signal?: NodeJS.Signals) =>
        applyFault(faults, "process.kill", () => base.ports.process.kill(pid, signal)),
      isRunning: (pid: number) => base.ports.process.isRunning(pid),
      onExit: (pid, cb) => base.ports.process.onExit(pid, cb),
    },
    docker: {
      run: (spec: LaunchSpec) => applyFault(faults, "docker.run", () => base.ports.docker.run(spec)),
      stop: (name: string) => applyFault(faults, "docker.stop", () => base.ports.docker.stop(name)),
      isRunning: (name: string) => base.ports.docker.isRunning(name),
      imageExists: (image: string) =>
        applyFault(faults, "docker.imageExists", () => base.ports.docker.imageExists(image)),
      pullImage: (image: string, onProgress?) =>
        applyFault(faults, "docker.pullImage", () => base.ports.docker.pullImage(image, onProgress)),
    },
    network: {
      probe: (host: string, port: number, timeoutMs: number): Promise<PortProbeResult> =>
        applyFault(faults, "network.probe", () => base.ports.network.probe(host, port, timeoutMs)),
    },
  };

  return { ports, sim: base.sim };
}
