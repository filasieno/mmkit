#!/usr/bin/env node
import * as fs from "node:fs";
import * as net from "node:net";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const CB = process.env.MMKIT_CBSERVER_BIN;
if (!CB || !fs.existsSync(CB)) {
  console.error("Set MMKIT_CBSERVER_BIN to a real cbserver binary");
  process.exit(1);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cb-smoke-"));
const port = 14000 + Math.floor(Math.random() * 1000);
for (const d of ["workspace", "tmp", "load"]) fs.mkdirSync(path.join(tmp, d), { recursive: true });

const args = ["-db", path.join(tmp, "workspace"), "-u", "persistent", "-load", path.join(tmp, "load"), "-p", String(port)];
console.log("spawn", CB, args.join(" "));
const child = spawn(CB, args, { stdio: "inherit", env: { ...process.env, TMPDIR: path.join(tmp, "tmp") } });

async function waitPort(ms = 60000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    const ok = await new Promise((resolve) => {
      const s = net.connect(port, "127.0.0.1", () => {
        s.end();
        resolve(true);
      });
      s.on("error", () => resolve(false));
    });
    if (ok) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

const up = await waitPort();
child.kill("SIGTERM");
if (!up) {
  console.error("FAIL: port not reachable");
  process.exit(1);
}
console.log("OK: cbserver listening on", port);
