import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { FIELD_REGISTRY } from "../src/config/schema";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const pkgPath = path.join(root, "package.json");

function property(meta: (typeof FIELD_REGISTRY)[number]) {
  const prop: Record<string, unknown> = {
    type: meta.type,
    default: meta.default,
    description: meta.description || meta.title,
  };
  if (meta.enum) prop.enum = meta.enum;
  if (meta.scope) prop.scope = meta.scope;
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

configuration[0].properties["mmkit.languageServer.trace"] = {
  type: "string",
  default: "off",
  description: "Trace LSP messages to the MMKit Trace output channel.",
  enum: ["off", "messages", "verbose"],
};
configuration[0].properties["mmkit.languageServer.lspPort"] = {
  type: "number",
  default: 16011,
  description: "Host TCP port for the ConceptBase language server.",
};
configuration[0].properties["mmkit.languageServer.httpPort"] = {
  type: "number",
  default: 28080,
  description: "Host HTTP port for LSP health, readiness, Prometheus metrics, and MCP (/mcp).",
};

const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as Record<string, unknown>;
const contributes = (pkg.contributes as Record<string, unknown>) ?? {};
contributes.configuration = configuration;
contributes.commands = [
  { command: "mmkit.startServer", title: "Start mmkit server", category: "Metamodelling Kit" },
  { command: "mmkit.stopServer", title: "Stop mmkit server", category: "Metamodelling Kit" },
  { command: "mmkit.connect", title: "Connect to mmkit server", category: "Metamodelling Kit" },
  { command: "mmkit.disconnect", title: "Disconnect from mmkit server", category: "Metamodelling Kit" },
  { command: "mmkit.openSettings", title: "Open mmkit Settings", category: "Metamodelling Kit" },
  { command: "mmkit.showTrace", title: "Show MMKit Trace", category: "Metamodelling Kit" },
  { command: "mmkit.connectionTest", title: "Test cbserver Connection (ASK)", category: "Metamodelling Kit" },
  { command: "mmkit.newNotebook", title: "New MM Notebook", category: "Metamodelling Kit" },
  {
    command: "mmkit.openNodeEditor",
    title: "Open Node Editor",
    category: "Metamodelling Kit",
  },
  {
    command: "mmkit.restartLanguageServer",
    title: "Restart ConceptBase Language Server",
    category: "Metamodelling Kit",
  },
];
contributes.customEditors = [
  {
    viewType: "mmkit.nodeEditor",
    displayName: "ConceptBase Browser",
    selector: [{ scheme: "mmkit-node" }],
    priority: "default",
  },
];
contributes.semanticTokenTypes = [
  { id: "macro", "superType": "string", description: "MSFOL / ECArule assertion embedding" },
  { id: "operator", description: "Assertion delimiters and operators" },
];
contributes.semanticTokenModifiers = [
  { id: "defaultLibrary", description: "Built-in functor or literal" },
];
contributes.semanticTokenScopes = [
  {
    language: "conceptbase",
    scopes: {
      keyword: ["keyword.control.conceptbase", "keyword.other.conceptbase"],
      function: ["entity.name.function.conceptbase"],
      "function.defaultLibrary": ["support.function.conceptbase"],
      variable: ["variable.other.conceptbase"],
      string: ["string.quoted.double.conceptbase"],
      number: ["constant.numeric.conceptbase"],
      comment: ["comment.line.conceptbase", "comment.block.conceptbase"],
      macro: ["meta.embedded.line.conceptbase"],
      operator: ["punctuation.section.embedded.begin.conceptbase"],
    },
  },
];
contributes.languages = [
  {
    id: "conceptbase",
    aliases: ["ConceptBase", "CBL", "Telos"],
    extensions: [".cbs"],
    configuration: "./language-configuration.json",
  },
];
contributes.grammars = [
  {
    language: "conceptbase",
    scopeName: "source.conceptbase",
    path: "./syntaxes/conceptbase.tmLanguage.json",
  },
];
contributes.notebooks = [
  {
    type: "mmkit.conceptbase-notebook",
    displayName: "MM Notebook",
    selector: [{ filenamePattern: "*.mmnb" }],
  },
];
contributes.notebookCell = [
  {
    type: "code",
    language: "conceptbase",
    notebook: "mmkit.conceptbase-notebook",
  },
];
contributes.viewsContainers = {
  activitybar: [
    {
      id: "mmkit",
      title: "Metamodelling Kit",
      icon: "media/mmkit.svg",
    },
  ],
};
contributes.views = {
  mmkit: [
    {
      id: "mmkit.panel",
      name: "MMKit",
      type: "webview",
    },
  ],
};
pkg.contributes = contributes;
pkg.activationEvents = [
  "onLanguage:conceptbase",
  "onNotebook:mmkit.conceptbase-notebook",
  "onCustomEditor:mmkit.nodeEditor",
  "onStartupFinished",
];
pkg.main = "./out/extension.js";
fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
