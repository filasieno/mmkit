#!/usr/bin/env node
/**
 * Reads cbserver-settings.meta.yaml and writes cbserver-settings.meta.gen.ts
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..");
const require = createRequire(
  path.join(repoRoot, "packages/server/package.json"),
);
const yaml = require("js-yaml");
const configRoot = path.join(
  repoRoot,
  "packages/server/src/cbserver/actors/server/settings",
);
const yamlPath = path.join(configRoot, "cbserver-settings.meta.yaml");
const outPath = path.join(configRoot, "cbserver-settings.meta.gen.ts");

const raw = fs.readFileSync(yamlPath, "utf8");
const doc = yaml.load(raw);

if (!doc || typeof doc !== "object" || !Array.isArray(doc.fields)) {
  throw new Error(`${yamlPath}: expected top-level 'fields' array`);
}

const header = `// AUTO-GENERATED from cbserver-settings.meta.yaml — do not edit.
// Regenerate: node tools/generate-cbserver-settings-meta.mjs
`;

const body = `export const CB_SERVER_SETTINGS_META_DOC = ${JSON.stringify(
  {
    schemaVersion: doc.schemaVersion,
    model: doc.model,
    docRefs: doc.docRefs ?? {},
    groups: doc.groups ?? {},
  },
  null,
  2,
)} as const;

export const CB_SERVER_SETTING_META = ${JSON.stringify(doc.fields, null, 2)} as const;
`;

fs.writeFileSync(outPath, header + body);
console.log(`wrote ${path.relative(repoRoot, outPath)} (${doc.fields.length} fields)`);
