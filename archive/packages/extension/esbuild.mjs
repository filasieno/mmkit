import * as esbuild from "esbuild";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

await esbuild.build({
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

const panelOutDir = path.join(__dirname, "out/panel-webview");
fs.mkdirSync(panelOutDir, { recursive: true });

await esbuild.build({
  entryPoints: [path.join(__dirname, "src/panel/webview/main.tsx")],
  bundle: true,
  platform: "browser",
  format: "iife",
  outfile: path.join(panelOutDir, "main.js"),
  sourcemap: true,
  jsx: "automatic",
  loader: { ".css": "css" },
  logLevel: "info",
});

fs.copyFileSync(
  path.join(__dirname, "src/panel/webview/panel.css"),
  path.join(panelOutDir, "main.css")
);

const nodeEditorOutDir = path.join(__dirname, "out/node-editor-webview");
fs.mkdirSync(nodeEditorOutDir, { recursive: true });

await import("./scripts/compile-slug-shaders.mjs");

await esbuild.build({
  entryPoints: [path.join(__dirname, "src/node-editor/webview/main.ts")],
  bundle: true,
  platform: "browser",
  format: "iife",
  outfile: path.join(nodeEditorOutDir, "main.js"),
  sourcemap: true,
  loader: { ".wasm": "file" },
  assetNames: "assets/[name]",
  logLevel: "info",
});

fs.copyFileSync(
  path.join(__dirname, "src/node-editor/webview/editor.css"),
  path.join(nodeEditorOutDir, "main.css")
);
fs.copyFileSync(
  path.join(__dirname, "src/node-editor/webview/test.html"),
  path.join(nodeEditorOutDir, "test.html")
);
