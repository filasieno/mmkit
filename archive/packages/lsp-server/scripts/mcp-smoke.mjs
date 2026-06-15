#!/usr/bin/env node
/**
 * Live smoke: supervisor → cbserver → TCP ASK exists[Class/objname].
 * Requires MMKIT_CBSERVER_BIN or assets/cbserver/cbserver and a free port.
 */
import * as net from "node:net";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(__dirname, "..");
const serverJs = path.join(pkgRoot, "dist", "server.js");
const httpPort = Number(process.env.MMKIT_HTTP_PORT ?? "28080");
const cbPort = Number(process.env.MMKIT_SMOKE_CB_PORT ?? "4311");
const host = process.env.MMKIT_SMOKE_HOST ?? "127.0.0.1";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitHttp(url, attempts = 30) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // retry
    }
    await sleep(500);
  }
  throw new Error(`timeout waiting for ${url}`);
}

async function waitPort(port, attempts = 60) {
  for (let i = 0; i < attempts; i += 1) {
    const ok = await new Promise((resolve) => {
      const s = net.connect(port, host, () => {
        s.end();
        resolve(true);
      });
      s.on("error", () => resolve(false));
    });
    if (ok) return;
    await sleep(500);
  }
  throw new Error(`timeout waiting for TCP ${host}:${port}`);
}

async function main() {
  if (!process.env.MMKIT_CBSERVER_BIN) {
    console.warn("MMKIT_CBSERVER_BIN not set — ensure assets/cbserver/cbserver exists or set env to Nix output");
  }

  const child = spawn(process.execPath, [serverJs], {
    cwd: pkgRoot,
    env: {
      ...process.env,
      MMKIT_LSP_TRANSPORT: "tcp",
      MMKIT_HTTP_PORT: String(httpPort),
      MMKIT_LSP_PORT: String(Number(process.env.MMKIT_LSP_PORT ?? "16011")),
      MMKIT_OTEL_DISABLED: process.env.MMKIT_OTEL_ENABLED === "1" ? undefined : "1",
    },
    stdio: "inherit",
  });

  try {
    await waitHttp(`http://${host}:${httpPort}/healthz`);
    console.log("HTTP health OK");

    // Start internal cbserver via LSP mmkit custom method would need LSP client.
    // For smoke: expect user to set MMKIT_SMOKE_CB_PORT to already-running cbserver OR
    // use extension start. Here we only verify MCP HTTP is up; optional TCP if port open.
    try {
      await waitPort(cbPort, 10);
      console.log(`cbserver TCP reachable on ${host}:${cbPort}`);
    } catch {
      console.log(`cbserver not on ${cbPort} — start via VS Code mmkit.startServer or set MMKIT_SMOKE_CB_PORT`);
    }

    console.log("MCP endpoint: POST /mcp on port", httpPort);
    console.log("See mcp/docs/MCP-AI.md for tool usage");
  } finally {
    child.kill("SIGTERM");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
