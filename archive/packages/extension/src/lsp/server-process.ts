import * as http from "node:http";
import { spawn, type ChildProcess } from "node:child_process";
import * as net from "node:net";
import type { LanguageServerLaunchSettings } from "./launch-config";

export interface ServerProcessHandle {
  child: ChildProcess;
  settings: LanguageServerLaunchSettings;
}

export function serverProcessEnv(
  settings: LanguageServerLaunchSettings,
  assetRoot: string,
  testMode: boolean
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    MMKIT_LSP_TRANSPORT: settings.transport,
    MMKIT_LSP_PORT: String(settings.lspPort),
    MMKIT_HTTP_PORT: String(settings.httpPort),
    MMKIT_ASSET_ROOT: assetRoot,
  };
  // OpenTelemetry is off unless explicitly enabled for the LSP child process.
  if (process.env.MMKIT_OTEL_ENABLED !== "1") {
    env.MMKIT_OTEL_DISABLED = "1";
  }
  if (testMode) {
    env.MMKIT_HTTP_DISABLED = "1";
    env.MMKIT_OTEL_DISABLED = "1";
    env.MMKIT_LSP_TRANSPORT = "stdio";
  }
  return env;
}

export function spawnLanguageServerProcess(
  serverModule: string,
  settings: LanguageServerLaunchSettings,
  assetRoot: string,
  testMode: boolean
): ServerProcessHandle {
  const env = serverProcessEnv(settings, assetRoot, testMode);
  const child = spawn(process.execPath, [serverModule], {
    env,
    stdio: settings.transport === "stdio" ? "pipe" : "ignore",
    detached: settings.transport === "tcp",
  });
  if (settings.transport === "tcp") {
    child.unref();
  }
  return { child, settings };
}

export function waitForHttpReady(host: string, port: number, timeoutMs = 30_000): Promise<void> {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = (): void => {
      const req = http.get(`http://${host}:${port}/readyz`, (res) => {
        res.resume();
        if (res.statusCode === 200) {
          resolve();
          return;
        }
        retry();
      });
      req.on("error", () => retry());
      req.setTimeout(2000, () => {
        req.destroy();
        retry();
      });
    };
    const retry = (): void => {
      if (Date.now() - started > timeoutMs) {
        reject(new Error(`HTTP ready probe timed out (${host}:${port})`));
        return;
      }
      setTimeout(attempt, 200);
    };
    attempt();
  });
}

export function connectLspSocket(port: number, host = "127.0.0.1", timeoutMs = 30_000): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ port, host });
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error(`LSP TCP connect timed out (${host}:${port})`));
    }, timeoutMs);
    socket.once("connect", () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.once("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

export async function stopServerProcess(handle: ServerProcessHandle | undefined): Promise<void> {
  if (!handle?.child.pid) return;
  try {
    handle.child.kill("SIGTERM");
  } catch {
    // process may already be gone
  }
}
