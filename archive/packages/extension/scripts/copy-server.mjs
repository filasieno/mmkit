import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extRoot = path.resolve(__dirname, "..");
const serverDist = path.resolve(extRoot, "../lsp-server/dist");
const targetDir = path.join(extRoot, "server");

fs.mkdirSync(targetDir, { recursive: true });

const serverJs = path.join(serverDist, "server.js");
if (!fs.existsSync(serverJs)) {
  throw new Error(`missing ${serverJs} — run npm run build -w @mmkit/lsp-server first`);
}

fs.copyFileSync(serverJs, path.join(targetDir, "server.js"));
const map = path.join(serverDist, "server.js.map");
if (fs.existsSync(map)) fs.copyFileSync(map, path.join(targetDir, "server.js.map"));

const wasm = path.join(serverDist, "tree-sitter-conceptbase.wasm");
if (fs.existsSync(wasm)) {
  fs.copyFileSync(wasm, path.join(targetDir, "tree-sitter-conceptbase.wasm"));
}
