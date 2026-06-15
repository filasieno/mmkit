import type { LaunchSpec, PortProbeResult, ProcessInfo, RawMmkitSettings, ResolvedPaths, TcpConnectResult, TcpSendResult } from "../../src/types";
import type { InstallProgressCallback } from "../../src/install/progress";
import type { MmkitPorts } from "../../src/ports/types";
import { createSimPorts } from "../../src/ports/sim/sim-ports";
import { applyFault, applyFaultSync, type FaultRegistry } from "./fault-injection";

export function createFaultablePorts(faults: FaultRegistry) {
  const base = createSimPorts();

  const ports: MmkitPorts = {
    vscodeConfig: {
      readConfiguration: (resource) =>
        applyFaultSync(faults, "vscodeConfig.readConfiguration", () => base.vscodeConfig.readConfiguration(resource)),
      executeUpdate: (patch, resource) =>
        applyFault(faults, "vscodeConfig.executeUpdate", () => base.vscodeConfig.executeUpdate(patch, resource)),
    },
    fs: {
      ensureDir: (dir) => applyFault(faults, "fs.ensureDir", () => base.fs.ensureDir(dir)),
      exists: (dir) => applyFault(faults, "fs.exists", () => base.fs.exists(dir)),
    },
    assets: {
      getAssetRoot: () => base.assets.getAssetRoot(),
      isInstallationComplete: (paths) =>
        applyFault(faults, "assets.isInstallationComplete", () => base.assets.isInstallationComplete(paths)),
      materialize: (paths: ResolvedPaths, onProgress?: InstallProgressCallback) =>
        applyFault(faults, "assets.materialize", () => base.assets.materialize(paths, onProgress)),
    },
    ui: base.ui,
    process: {
      spawn: (spec: LaunchSpec) => applyFault(faults, "process.spawn", () => base.process.spawn(spec)),
      kill: (pid: number, signal?: NodeJS.Signals) =>
        applyFault(faults, "process.kill", () => base.process.kill(pid, signal)),
      isRunning: (pid: number) => base.process.isRunning(pid),
      onExit: (pid, cb) => base.process.onExit(pid, cb),
    },
    docker: {
      run: (spec: LaunchSpec) => applyFault(faults, "docker.run", () => base.sim.docker.run(spec)),
      stop: (name: string) => applyFault(faults, "docker.stop", () => base.sim.docker.stop(name)),
      isRunning: (name: string) => base.sim.docker.isRunning(name),
      imageExists: (image: string) =>
        applyFault(faults, "docker.imageExists", () => base.sim.docker.imageExists(image)),
      pullImage: (image: string, onProgress?) =>
        applyFault(faults, "docker.pullImage", () => base.sim.docker.pullImage(image, onProgress)),
    },
    network: {
      probe: (host: string, port: number, timeoutMs: number): Promise<PortProbeResult> =>
        applyFault(faults, "network.probe", () => base.network.probe(host, port, timeoutMs)),
    },
    tcp: {
      connect: (host: string, port: number, timeoutMs: number): Promise<TcpConnectResult> =>
        applyFault(faults, "tcp.connect", () => base.tcp.connect(host, port, timeoutMs)),
      enroll: (socketId: string, toolName: string, userName: string): Promise<TcpSendResult> =>
        applyFault(faults, "tcp.enroll", () => base.tcp.enroll(socketId, toolName, userName)),
      disconnect: (socketId: string, client: string, serverName: string): Promise<TcpSendResult> =>
        applyFault(faults, "tcp.disconnect", () => base.tcp.disconnect(socketId, client, serverName)),
      close: (socketId: string) => applyFault(faults, "tcp.close", () => base.tcp.close(socketId)),
      send: (socketId, method, data, client, serverName) =>
        base.tcp.send(socketId, method, data, client, serverName),
    },
    panel: {
      render: async (viewModel) => {
        const fault = faults.get("panel.render");
        if (fault?.mode === "return-error") {
          return base.panel.render(viewModel);
        }
        return applyFault(faults, "panel.render", () => base.panel.render(viewModel));
      },
      onInteraction: (handler) => base.panel.onInteraction(handler),
      isVisible: () => base.panel.isVisible(),
    },
  };

  return { ports, sim: base.sim, base };
}
