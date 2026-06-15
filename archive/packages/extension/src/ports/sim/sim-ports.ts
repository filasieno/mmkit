import { EventEmitter } from "node:events";
import { DEFAULT_RAW } from "../../config/schema";
import { buildEnrollPayload, buildIpcMessage, lengthPrefix, parseAnswerTerm } from "../../protocol/cb-tcp";
import * as path from "node:path";
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
} from "../../types";
import { materializeInstallAssets } from "../../install/materialize";
import type { InstallProgressCallback } from "../../install/progress";
import type { AssetPort, DockerPort, FsPort, MmkitPorts, NetworkPort, PanelPort, ProcessPort, TcpPort, UiPort, VscodeConfigPort } from "../types";

export class SimAssetPort implements AssetPort {
  installedMarkers = new Set<string>();
  materializeCalls = 0;

  getAssetRoot(): string {
    // Compiled tests live under out-test/ — resolve back to components/mmkit/assets.
    return path.join(__dirname, "..", "..", "..", "..", "assets", "cbserver");
  }

  async isInstallationComplete(paths: ResolvedPaths): Promise<boolean> {
    return this.installedMarkers.has(paths.installMarker);
  }

  async materialize(paths: ResolvedPaths, onProgress?: InstallProgressCallback): Promise<void> {
    this.materializeCalls += 1;
    await materializeInstallAssets(this.getAssetRoot(), paths, onProgress);
    this.installedMarkers.add(paths.installMarker);
  }
}

export class SimUiPort implements UiPort {
  visible = false;
  /** Set when showInstallProgress was called at least once (survives hide). */
  everVisible = false;
  title = "";
  messages: Array<{ message: string; percent: number }> = [];
  lastPercent = 0;

  showInstallProgress(title: string): void {
    this.visible = true;
    this.everVisible = true;
    this.title = title;
    this.lastPercent = 0;
  }

  hideInstallProgress(): void {
    this.visible = false;
    this.title = "";
    this.lastPercent = 0;
  }

  reportInstallProgress(message: string, percent: number): void {
    this.lastPercent = Math.max(this.lastPercent, percent);
    this.messages.push({ message, percent: this.lastPercent });
  }
}

export class SimFsPort implements FsPort {
  readonly dirs = new Set<string>();

  async ensureDir(path: string): Promise<void> {
    this.dirs.add(path);
  }

  async exists(path: string): Promise<boolean> {
    return this.dirs.has(path);
  }
}

export class SimVscodeConfigPort implements VscodeConfigPort {
  constructor(private settings: RawMmkitSettings = structuredClone(DEFAULT_RAW)) {}

  readConfiguration(): RawMmkitSettings {
    return structuredClone(this.settings);
  }

  async executeUpdate(patch: Record<string, unknown>): Promise<void> {
    this.settings = mergePatch(this.settings, patch);
  }

  setSettings(settings: RawMmkitSettings): void {
    this.settings = structuredClone(settings);
  }
}

function mergePatch(base: RawMmkitSettings, patch: Record<string, unknown>): RawMmkitSettings {
  const next = structuredClone(base);
  for (const [key, value] of Object.entries(patch)) {
    if (key === "operationalMode") {
      next.operationalMode = value as RawMmkitSettings["operationalMode"];
      continue;
    }
    if (key === "traceLevel") {
      next.traceLevel = value as RawMmkitSettings["traceLevel"];
      continue;
    }
    if (key.startsWith("server.")) {
      const field = key.slice("server.".length) as keyof RawMmkitSettings["server"];
      (next.server as unknown as Record<string, unknown>)[field] = value;
      continue;
    }
    if (key.startsWith("client.")) {
      const field = key.slice("client.".length) as keyof RawMmkitSettings["client"];
      (next.client as unknown as Record<string, unknown>)[field] = value;
    }
  }
  return next;
}

interface SimProcess {
  pid: number;
  spec: LaunchSpec;
  running: boolean;
  emitter: EventEmitter;
}

export class SimProcessPort implements ProcessPort {
  private nextPid = 1000;
  private processes = new Map<number, SimProcess>();
  private startupTimer?: ReturnType<typeof setTimeout>;
  /** When set, executable launch marks the port reachable after a short delay (like docker.run). */
  network?: SimNetworkPort;
  startupDelayMs = 50;

  private armStartupTimer(): void {
    this.cancelStartupTimer();
    if (!this.network) return;
    this.network.reachable = false;
    this.startupTimer = setTimeout(() => {
      this.startupTimer = undefined;
      if (this.network) this.network.reachable = true;
    }, this.startupDelayMs);
  }

  private cancelStartupTimer(): void {
    if (this.startupTimer === undefined) return;
    clearTimeout(this.startupTimer);
    this.startupTimer = undefined;
  }

  async spawn(spec: LaunchSpec): Promise<ProcessInfo> {
    const pid = this.nextPid++;
    const proc: SimProcess = { pid, spec, running: true, emitter: new EventEmitter() };
    this.processes.set(pid, proc);
    this.armStartupTimer();
    return { pid, command: spec.command };
  }

  async kill(pid: number): Promise<void> {
    const proc = this.processes.get(pid);
    if (!proc || !proc.running) return;
    proc.running = false;
    this.cancelStartupTimer();
    if (this.network) {
      this.network.reachable = false;
    }
    proc.emitter.emit("exit", 0, null);
  }

  async isRunning(pid: number): Promise<boolean> {
    return this.processes.get(pid)?.running ?? false;
  }

  onExit(pid: number, cb: (code: number | null, signal: NodeJS.Signals | null) => void): () => void {
    const proc = this.processes.get(pid);
    if (!proc) return () => undefined;
    proc.emitter.on("exit", cb);
    return () => proc.emitter.off("exit", cb);
  }

  simulateExit(pid: number, code = 1): void {
    const proc = this.processes.get(pid);
    if (!proc?.running) return;
    proc.running = false;
    proc.emitter.emit("exit", code, null);
  }
}

export class SimDockerPort implements DockerPort {
  private containers = new Map<string, boolean>();
  private images = new Set<string>(["conceptbase-cbserver:0.1.1"]);
  private startupTimer?: ReturnType<typeof setTimeout>;
  /** Simulated container boot time before the port becomes reachable. */
  startupDelayMs = 50;
  network?: SimNetworkPort;

  private armStartupTimer(): void {
    this.cancelStartupTimer();
    if (!this.network) return;
    this.network.reachable = false;
    this.startupTimer = setTimeout(() => {
      this.startupTimer = undefined;
      if (this.network) this.network.reachable = true;
    }, this.startupDelayMs);
  }

  cancelStartupTimer(): void {
    if (this.startupTimer === undefined) return;
    clearTimeout(this.startupTimer);
    this.startupTimer = undefined;
  }

  async run(spec: LaunchSpec): Promise<ProcessInfo> {
    const nameIdx = spec.args.indexOf("--name");
    const name = nameIdx >= 0 ? spec.args[nameIdx + 1] : "sim-container";
    this.containers.set(name, true);
    this.armStartupTimer();
    return { pid: 0, command: "docker" };
  }

  async stop(containerName: string): Promise<void> {
    this.cancelStartupTimer();
    this.containers.set(containerName, false);
    if (this.network) {
      this.network.reachable = false;
    }
  }

  async isRunning(containerName: string): Promise<boolean> {
    return this.containers.get(containerName) ?? false;
  }

  async imageExists(image: string): Promise<boolean> {
    return this.images.has(image);
  }

  async pullImage(image: string, onProgress?: (message: string, fractionWithinStep: number) => void): Promise<void> {
    onProgress?.(`Pulling Docker image ${image}…`, 0);
    onProgress?.("Pulling fs layer", 0.33);
    onProgress?.("Downloading", 0.66);
    onProgress?.(`Image ${image} ready`, 1);
    this.images.add(image);
  }
}

export class SimNetworkPort implements NetworkPort {
  reachable = false;

  async probe(_host: string, _port: number): Promise<PortProbeResult> {
    if (!this.reachable) {
      return { reachable: false, error: "sim port not open yet" };
    }
    return { reachable: true, latencyMs: 1 };
  }
}

interface SimSocket {
  id: string;
  enrolled: boolean;
  serverName: string;
  client: string;
}

export class SimPanelPort implements PanelPort {
  lastViewModel?: PanelViewModel;
  visible = true;
  private handlers = new Set<(interaction: PanelInteraction) => void>();

  async render(viewModel: PanelViewModel): Promise<void> {
    this.lastViewModel = structuredClone(viewModel);
  }

  onInteraction(handler: (interaction: PanelInteraction) => void): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  isVisible(): boolean {
    return this.visible;
  }

  /** Test helper — inject a user interaction from the sim webview. */
  simulateInteraction(interaction: PanelInteraction): void {
    for (const handler of this.handlers) handler(interaction);
  }
}

export class SimTcpPort implements TcpPort {
  private nextId = 1;
  private sockets = new Map<string, SimSocket>();
  failConnect = false;

  async connect(): Promise<TcpConnectResult> {
    if (this.failConnect) {
      return { ok: false, error: "sim connect failed" };
    }
    const id = `sim-${this.nextId++}`;
    this.sockets.set(id, { id, enrolled: false, serverName: '""', client: '""' });
    return { ok: true, socketId: id };
  }

  async enroll(socketId: string, toolName: string, userName: string): Promise<TcpSendResult> {
    const sock = this.sockets.get(socketId);
    if (!sock) return { ok: false, error: "unknown socket" };
    const payload = buildEnrollPayload(toolName, userName);
    const msg = buildIpcMessage('""', '""', "ENROLL_ME", payload);
    lengthPrefix(msg);
    sock.enrolled = true;
    sock.serverName = '"cbserver"';
    sock.client = `"${toolName}"`;
    return { ok: true, completion: "ok", sender: sock.serverName, returnData: toolName };
  }

  async send(socketId: string, method: string, data: string, client: string, serverName: string): Promise<TcpSendResult> {
    const sock = this.sockets.get(socketId);
    if (!sock) return { ok: false, error: "unknown socket" };
    buildIpcMessage(client, serverName, method, data);
    if (method === "ASK" && data.includes("exists[Class/objname]")) {
      return { ok: true, completion: "ok", returnData: "yes", sender: serverName };
    }
    if (method === "CANCEL_ME") {
      return { ok: true, completion: "ok" };
    }
    return { ok: true, completion: "ok" };
  }

  async disconnect(socketId: string): Promise<TcpSendResult> {
    this.sockets.delete(socketId);
    return { ok: true, completion: "ok" };
  }

  async close(socketId: string): Promise<void> {
    this.sockets.delete(socketId);
  }
}

export function createSimPorts(overrides?: Partial<MmkitPorts>): MmkitPorts & {
  sim: {
    config: SimVscodeConfigPort;
    assets: SimAssetPort;
    ui: SimUiPort;
    process: SimProcessPort;
    docker: SimDockerPort;
    network: SimNetworkPort;
    tcp: SimTcpPort;
    panel: SimPanelPort;
  };
} {
  const config = new SimVscodeConfigPort();
  const assets = new SimAssetPort();
  const ui = new SimUiPort();
  const network = new SimNetworkPort();
  const process = new SimProcessPort();
  process.network = network;
  const docker = new SimDockerPort();
  docker.network = network;
  const tcp = new SimTcpPort();
  const panel = new SimPanelPort();
  const ports: MmkitPorts = {
    vscodeConfig: config,
    fs: new SimFsPort(),
    assets,
    ui,
    process,
    docker,
    network,
    tcp,
    panel,
    ...overrides,
  };
  return { ...ports, sim: { config, assets, ui, process, docker, network, tcp, panel } };
}

export { parseAnswerTerm };
