import * as esbuild from "esbuild";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const watch = process.argv.includes("--watch");

const ctx = await esbuild.context({
  entryPoints: [path.join(__dirname, "src/extension.ts")],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: path.join(__dirname, "out/extension.js"),
  external: ["vscode"],
  sourcemap: true,
  tsconfig: path.join(__dirname, "tsconfig.json"),
  logLevel: "info",
});

if (watch) {
  await ctx.watch();
} else {
  await ctx.rebuild();
  await ctx.dispose();
}
