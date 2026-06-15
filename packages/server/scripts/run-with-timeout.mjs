#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";

function usageAndExit() {
  console.error("usage: node scripts/run-with-timeout.mjs <timeout-ms> <command>");
  process.exit(2);
}

const timeoutMs = Number(process.argv[2]);
const command = process.argv.slice(3).join(" ").trim();

if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || command.length === 0) {
  usageAndExit();
}

function dumpProcessSnapshot(rootPid) {
  try {
    const ps = spawnSync("ps", ["-eo", "pid,ppid,pgid,stat,etime,command"], { encoding: "utf8" });
    if (ps.status !== 0) {
      console.error("[watchdog] could not collect process snapshot");
      return;
    }
    const lines = ps.stdout.split("\n").filter((line) => line.trim().length > 0);
    if (lines.length === 0) {
      return;
    }
    const header = lines[0];
    const entries = lines.slice(1);
    const relevant = entries.filter((line) => {
      const parts = line.trim().split(/\s+/, 6);
      if (parts.length < 3) {
        return false;
      }
      const pid = Number(parts[0]);
      const ppid = Number(parts[1]);
      const pgid = Number(parts[2]);
      return pid === rootPid || ppid === rootPid || pgid === rootPid;
    });

    console.error("[watchdog] process snapshot at timeout:");
    console.error(header);
    for (const line of relevant) {
      console.error(line);
    }
    if (relevant.length === 0) {
      console.error("[watchdog] no matching process rows found");
    }
  } catch (err) {
    console.error("[watchdog] failed to capture process snapshot:", err);
  }
}

function killGroup(rootPid, signal) {
  try {
    process.kill(-rootPid, signal);
    return true;
  } catch {
    return false;
  }
}

console.error(`[watchdog] starting with timeout ${timeoutMs}ms`);
console.error(`[watchdog] command: ${command}`);

const child = spawn(command, {
  shell: true,
  detached: true,
  stdio: "inherit",
});

let timedOut = false;
let hardKillTimer;

const timeoutTimer = setTimeout(() => {
  timedOut = true;
  console.error(`[watchdog] timeout reached after ${timeoutMs}ms`);
  dumpProcessSnapshot(child.pid);

  const termOk = killGroup(child.pid, "SIGTERM");
  if (termOk) {
    console.error("[watchdog] sent SIGTERM to process group");
  } else {
    console.error("[watchdog] SIGTERM process-group kill failed, trying direct pid");
    try {
      process.kill(child.pid, "SIGTERM");
    } catch {}
  }

  hardKillTimer = setTimeout(() => {
    const killOk = killGroup(child.pid, "SIGKILL");
    if (killOk) {
      console.error("[watchdog] sent SIGKILL to process group");
    } else {
      console.error("[watchdog] SIGKILL process-group kill failed, trying direct pid");
      try {
        process.kill(child.pid, "SIGKILL");
      } catch {}
    }
  }, 3000);
}, timeoutMs);

child.on("exit", (code, signal) => {
  clearTimeout(timeoutTimer);
  if (hardKillTimer !== undefined) {
    clearTimeout(hardKillTimer);
  }

  if (timedOut) {
    console.error(`[watchdog] child exited after timeout: code=${code ?? "null"} signal=${signal ?? "null"}`);
    process.exit(124);
    return;
  }

  if (signal !== null) {
    console.error(`[watchdog] child terminated by signal: ${signal}`);
    process.exit(1);
    return;
  }

  process.exit(code ?? 1);
});

