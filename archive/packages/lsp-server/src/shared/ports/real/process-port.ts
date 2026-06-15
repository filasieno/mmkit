import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import type { LaunchSpec, ProcessInfo } from "@mmkit/shared";
import type { ProcessPort } from "../types";

interface TrackedProcess {
  child: ReturnType<typeof spawn>;
  emitter: EventEmitter;
}

export class RealProcessPort implements ProcessPort {
  private readonly tracked = new Map<number, TrackedProcess>();

  async spawn(spec: LaunchSpec): Promise<ProcessInfo> {
    const child = spawn(spec.command, spec.args, {
      env: { ...process.env, ...spec.env },
      cwd: spec.cwd,
      // cbserver is verbose on stdout/stderr; unread pipes stall startup before the port opens.
      stdio: "ignore",
    });
    const emitter = new EventEmitter();
    const pid = child.pid ?? -1;
    this.tracked.set(pid, { child, emitter });
    child.on("exit", (code, signal) => {
      emitter.emit("exit", code, signal);
      this.tracked.delete(pid);
    });
    return { pid, command: spec.command };
  }

  async kill(pid: number, signal: NodeJS.Signals = "SIGTERM"): Promise<void> {
    this.tracked.get(pid)?.child.kill(signal);
  }

  async isRunning(pid: number): Promise<boolean> {
    const entry = this.tracked.get(pid);
    if (!entry) return false;
    return entry.child.exitCode === null && !entry.child.killed;
  }

  onExit(pid: number, cb: (code: number | null, signal: NodeJS.Signals | null) => void): () => void {
    const entry = this.tracked.get(pid);
    if (!entry) return () => undefined;
    entry.emitter.on("exit", cb);
    return () => entry.emitter.off("exit", cb);
  }
}
