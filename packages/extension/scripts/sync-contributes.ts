import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { HELLO_WORLD_COMMAND, OPEN_SETTINGS_COMMAND } from "@mmkit/base";
import { FIELD_REGISTRY } from "../src/settings/field-registry";
import type { FieldMeta } from "../src/settings/field-meta";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const pkgPath = path.join(root, "package.json");

function property(meta: FieldMeta) {
  const prop: Record<string, unknown> = {
    type: meta.type,
    default: meta.default,
    description: meta.description || meta.title,
  };
  if (meta.markdownDescription) {
    prop.markdownDescription = meta.markdownDescription;
  }
  if (meta.enum) {
    prop.enum = meta.enum;
  }
  if (meta.enumDescriptions) {
    prop.enumDescriptions = meta.enumDescriptions;
  }
  if (meta.scope) {
    prop.scope = meta.scope;
  }
  if (meta.order !== undefined) {
    prop.order = meta.order;
  }
  return prop;
}

const configuration = [
  { title: "Metamodelling Kit", order: 0, properties: {} as Record<string, unknown> },
  { title: "Server", order: 1, properties: {} as Record<string, unknown> },
  { title: "Client", order: 2, properties: {} as Record<string, unknown> },
];

for (const meta of FIELD_REGISTRY) {
  const idx = meta.category === "general" ? 0 : meta.category === "server" ? 1 : 2;
  configuration[idx].properties[meta.key] = property(meta);
}

const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as Record<string, unknown>;
const contributes = (pkg.contributes as Record<string, unknown>) ?? {};
contributes.configuration = configuration;
contributes.commands = [
  {
    command: HELLO_WORLD_COMMAND,
    title: "Hello World",
    category: "Metamodelling Kit",
  },
  {
    command: OPEN_SETTINGS_COMMAND,
    title: "Open mmkit Settings",
    category: "Metamodelling Kit",
  },
];
pkg.contributes = contributes;

fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
console.log(`sync-contributes: wrote ${FIELD_REGISTRY.length} settings to package.json`);
