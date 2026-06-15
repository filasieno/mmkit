import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extRoot = path.resolve(__dirname, "..");
const devRoot = path.resolve(extRoot, "../../dev");
const targetRoot = path.join(extRoot, "observability");

function copyRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

if (!fs.existsSync(devRoot)) {
  throw new Error(`missing ${devRoot} — observability dev stack not found`);
}

const wasmSrc = path.resolve(
  devRoot,
  "../../tree-sitter-conceptbase/target/lib/tree-sitter-conceptbase.wasm"
);
if (!fs.existsSync(wasmSrc)) {
  throw new Error(`missing ${wasmSrc} — build tree-sitter-conceptbase first`);
}

if (fs.existsSync(targetRoot)) {
  fs.rmSync(targetRoot, { recursive: true, force: true });
}
copyRecursive(devRoot, targetRoot);

const wasmName = "tree-sitter-conceptbase.wasm";
const wasmTargets = [
  path.join(targetRoot, "artifacts", wasmName),
  path.join(devRoot, "artifacts", wasmName),
  path.join(devRoot, "..", "artifacts", wasmName),
];
for (const target of wasmTargets) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(wasmSrc, target);
}

console.log(`copied observability stack to ${targetRoot}`);
