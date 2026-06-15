import * as esbuild from "esbuild";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

await esbuild.build({
  entryPoints: [path.join(__dirname, "src/system/main.ts")],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: path.join(__dirname, "dist/server.js"),
  sourcemap: true,
  tsconfig: path.join(__dirname, "tsconfig.json"),
  conditions: ["import", "require", "node"],
  mainFields: ["module", "main"],
  logLevel: "info",
});
