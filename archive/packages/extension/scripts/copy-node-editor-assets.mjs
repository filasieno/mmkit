import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extRoot = path.resolve(__dirname, "..");
const workspaceRoot = path.resolve(extRoot, "../..");
const targetDir = path.join(extRoot, "out/node-editor-webview");

function tryResolveModuleFile(...segments) {
  const candidates = [
    path.join(extRoot, "node_modules", ...segments),
    path.join(workspaceRoot, "node_modules", ...segments),
  ];
  return candidates.find((p) => fs.existsSync(p));
}

function resolveModuleFile(...segments) {
  const found = tryResolveModuleFile(...segments);
  if (!found) {
    throw new Error(`missing ${segments.join("/")} — run npm install in components/mmkit`);
  }
  return found;
}

fs.mkdirSync(targetDir, { recursive: true });

const hbWasm =
  tryResolveModuleFile("harfbuzzjs", "hb.wasm") ??
  tryResolveModuleFile("harfbuzzjs", "dist", "harfbuzz.wasm");
if (!hbWasm) {
  throw new Error("missing harfbuzz wasm — run npm install in components/mmkit");
}
fs.copyFileSync(hbWasm, path.join(targetDir, "hb.wasm"));

const fontSrc =
  tryResolveModuleFile("@fontsource", "inter", "files", "inter-latin-400-normal.woff") ??
  tryResolveModuleFile("@fontsource", "inter", "files", "inter-latin-ext-400-normal.woff");
if (!fontSrc) {
  throw new Error("missing Inter WOFF font — run npm install in components/mmkit");
}
fs.copyFileSync(fontSrc, path.join(targetDir, "Inter-Regular.woff"));
