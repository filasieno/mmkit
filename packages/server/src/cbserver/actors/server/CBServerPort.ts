import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import * as ihsm from "ihsm";
import { buildLaunchRequest } from "./settings/CBServerSettings";
import type { CBServerConfig } from "./settings/CBServerSettings";
import type { CBServerTop, CBServerMachineConfig, CBServerActorRef } from "./CBServerConfig";
import type { CBConnectionContext } from "../connection/CBServerConnectionContext";
import type { CBConnectionOrchestratorPort } from "../connection/CBConnectionOrchestratorPort";
import { probeTcpConnect } from "./tcpPortProbe";
import type { TcpConnectProbeOptions } from "./tcpPortProbe";
import { spawnLogReaderChildren } from "./spawnLogReaderChildren";
import { spawnConnectionChild } from "./spawnConnectionChild";

/** Live cbserver subprocesses — shared across {@link CBServerPort} instances. */
const trackedChildren = new Map<number, ChildProcess>();

let parentExitHookInstalled = false;

function childStillRunning(child: ChildProcess): boolean {
  return child.exitCode === null && child.signalCode === null && !child.killed;
}

/** Kill cbserver and any same-group descendants (Unix process group). */
export function killCbserverProcessTree(pid: number, signal: NodeJS.Signals = "SIGTERM"): void {
  if (process.platform === "win32") {
    try {
      process.kill(pid, signal);
    } catch {
      // already gone
    }
    return;
  }
  try {
    process.kill(-pid, signal);
  } catch {
    try {
      process.kill(pid, signal);
    } catch {
      // already gone
    }
  }
}

function reapTrackedChildrenOnParentExit(signal: NodeJS.Signals): void {
  for (const [pid, child] of trackedChildren) {
    if (!childStillRunning(child)) {
      trackedChildren.delete(pid);
      continue;
    }
    killCbserverProcessTree(pid, signal);
  }
}

function ensureParentExitHook(): void {
  if (parentExitHookInstalled) {
    return;
  }
  parentExitHookInstalled = true;
  process.on("exit", () => { reapTrackedChildrenOnParentExit("SIGKILL"); });
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
    process.on(signal, () => { reapTrackedChildrenOnParentExit("SIGKILL"); });
  }
}

function trackCbserverChild(pid: number, child: ChildProcess): void {
  trackedChildren.set(pid, child);
  ensureParentExitHook();
  child.once("exit", () => { trackedChildren.delete(pid); });
}

/** Test hook — register a child for parent-exit reap without spawning via {@link CBServerPort}. */
export function registerTrackedCbserverChild(pid: number, child: ChildProcess): void {
  trackCbserverChild(pid, child);
}

/** Subprocess port — Node `child_process` events become CBServer internal notifications. */
export class CBServerPort extends ihsm.Port<typeof CBServerTop> {
  async spawn(config: CBServerConfig): Promise<ihsm.ResultWithSubscription<number>> {
    const inbound = this.actor;
    const launch = buildLaunchRequest(config);
    const child = spawn(launch.executablePath, [...launch.args], { cwd: launch.cwd, env: launch.env, stdio: ["pipe", "pipe", "pipe"], detached: process.platform !== "win32", windowsHide: true });
    const subscription = this.bindChildProcess(child, inbound);
    const pid = child.pid ?? (await new Promise<number | undefined>((resolve) => { child.once("spawn", () => resolve(child.pid)); child.once("error", () => resolve(undefined)); }));
    if (pid === undefined) {
      subscription.dispose();
      throw new Error(`failed to spawn ${launch.executablePath}`);
    }
    trackCbserverChild(pid, child);
    return { value: pid, subscription };
  }

  async kill(pid: number, signal: NodeJS.Signals = "SIGTERM"): Promise<void> {
    killCbserverProcessTree(pid, signal);
  }

  async probeTcpConnect(options: TcpConnectProbeOptions): Promise<boolean> {
    return probeTcpConnect(options);
  }

  async armLogReaders(server: CBServerActorRef) {
    return spawnLogReaderChildren(server as never as ihsm.ParentActor<typeof CBServerTop>, server);
  }

  async spawnConnection(server: CBServerActorRef, context: CBConnectionContext, orchestratorPort: CBConnectionOrchestratorPort) {
    return spawnConnectionChild(server as never as ihsm.ParentActor<typeof CBServerTop>, context, orchestratorPort);
  }

  private bindChildProcess(child: ChildProcess, inbound: ihsm.InboundActor<CBServerMachineConfig>): ihsm.Disposable {
    let active = true;

    const detach = (): void => {
      if (!active) {
        return;
      }
      active = false;
      const pid = child.pid;
      if (pid !== undefined && childStillRunning(child)) {
        killCbserverProcessTree(pid, "SIGKILL");
        trackedChildren.delete(pid);
      }
      child.stdout?.removeAllListeners();
      child.stderr?.removeAllListeners();
      child.stdin?.removeAllListeners();
      child.removeAllListeners("exit");
      child.removeAllListeners("close");
      child.removeAllListeners("error");
      child.removeAllListeners("disconnect");
    };

    child.stdout?.on("data", (chunk: Buffer) => { if (active) { inbound.notify.onStdoutData(chunk.toString("utf8")); } });
    child.stdout?.once("end", () => active && inbound.notify.onStdoutEnd());
    child.stdout?.once("close", () => active && inbound.notify.onStdoutClose());
    child.stdout?.once("error", (err) => active && inbound.notify.onStdoutStdioError(String(err)));

    child.stderr?.on("data", (chunk: Buffer) => { if (active) { inbound.notify.onStderrData(chunk.toString("utf8")); } });
    child.stderr?.once("end", () => active && inbound.notify.onStderrEnd());
    child.stderr?.once("close", () => active && inbound.notify.onStderrClose());
    child.stderr?.once("error", (err) => active && inbound.notify.onStderrStdioError(String(err)));

    child.once("exit", (code, signal) => { if (!active) { return; } inbound.notify.onProcessExit(code, signal); detach(); });
    child.once("close", (code, signal) => { if (!active) { return; } inbound.notify.onProcessClose(code, signal); detach(); });
    child.once("error", (err) => { if (!active) { return; } inbound.notify.onProcessError(String(err)); detach(); });
    child.once("disconnect", () => { if (!active) { return; } inbound.notify.onDisconnect(); detach(); });

    return { dispose: detach };
  }
}
