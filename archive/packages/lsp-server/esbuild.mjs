import { execSync } from "node:child_process";
import * as esbuild from "esbuild";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, "dist");

fs.mkdirSync(distDir, { recursive: true });

// esbuild does not lower TypeScript stage-3 decorators; compile with tsc first.
execSync("npx tsc -p tsconfig.json", { cwd: __dirname, stdio: "inherit" });

const bundledMain = path.join(distDir, "main.js");
if (!fs.existsSync(bundledMain)) {
  throw new Error(`missing ${bundledMain} after tsc — check tsconfig outDir/rootDir`);
}

const otelExternals = [
  "@opentelemetry/api",
  "@opentelemetry/api-logs",
  "@opentelemetry/exporter-logs-otlp-http",
  "@opentelemetry/exporter-metrics-otlp-http",
  "@opentelemetry/exporter-trace-otlp-http",
  "@opentelemetry/resources",
  "@opentelemetry/sdk-logs",
  "@opentelemetry/sdk-metrics",
  "@opentelemetry/sdk-node",
  "@opentelemetry/semantic-conventions",
];

await esbuild.build({
  entryPoints: [bundledMain],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: path.join(distDir, "server.js"),
  sourcemap: true,
  logLevel: "info",
  external: otelExternals,
  // MCP packages are ESM-only; resolve their "import" export condition when bundling tsc output.
  conditions: ["import", "require", "node"],
  mainFields: ["module", "main"],
});

const wasmSrc = process.env.MMKIT_WASM_PATH
  ? path.resolve(process.env.MMKIT_WASM_PATH)
  : path.resolve(__dirname, "../../../tree-sitter-conceptbase/target/lib/tree-sitter-conceptbase.wasm");
if (fs.existsSync(wasmSrc)) {
  fs.copyFileSync(wasmSrc, path.join(distDir, "tree-sitter-conceptbase.wasm"));
}
