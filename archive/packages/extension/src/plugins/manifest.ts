/**
 * Single-extension manifest — documents every app plugin in the one `mmkit` VSIX.
 * Safe to import from unit tests (no `vscode` dependency).
 */

export const TRACE_PLUGIN_ID = "mmkit.trace";
export const LANGUAGE_TOOLING_PLUGIN_ID = "mmkit.language-tooling";
export const PANEL_PLUGIN_ID = "mmkit.panel";
export const NODE_EDITOR_PLUGIN_ID = "mmkit.node-editor";
export const SUPERVISOR_PLUGIN_ID = "mmkit.supervisor";

export const MMKIT_PLUGIN_IDS = [
  TRACE_PLUGIN_ID,
  SUPERVISOR_PLUGIN_ID,
  PANEL_PLUGIN_ID,
  NODE_EDITOR_PLUGIN_ID,
  LANGUAGE_TOOLING_PLUGIN_ID,
] as const;

export type MmkitPluginId = (typeof MMKIT_PLUGIN_IDS)[number];

/** Activation order for {@link MMKIT_APP_PLUGINS} in the single extension. */
export const MMKIT_PLUGIN_ACTIVATION_ORDER: readonly MmkitPluginId[] = MMKIT_PLUGIN_IDS;

export interface MmkitPluginManifestEntry {
  id: MmkitPluginId;
  features: readonly string[];
}

/** Human-readable map of what the single extension bundles. */
export const MMKIT_SINGLE_EXTENSION_MANIFEST: readonly MmkitPluginManifestEntry[] = [
  {
    id: TRACE_PLUGIN_ID,
    features: ["MMKit Trace output channel", "OTEL log hub"],
  },
  {
    id: SUPERVISOR_PLUGIN_ID,
    features: [
      "ExtensionSupervisor + cbserver actors",
      "command palette (start/stop/connect/LSP/notebook)",
      "status bar",
      "configuration listener",
    ],
  },
  {
    id: PANEL_PLUGIN_ID,
    features: ["MMKit activity-bar React panel", "panel port bridge"],
  },
  {
    id: NODE_EDITOR_PLUGIN_ID,
    features: [
      "ConceptBase browser custom editor (WebGL2)",
      "Slug GPU vector text rendering",
      "virtual mmkit-node documents",
      "mmkit.openNodeEditor command",
    ],
  },
  {
    id: LANGUAGE_TOOLING_PLUGIN_ID,
    features: [
      "ConceptBase LSP client",
      "bundled @mmkit/lsp-server process",
      "MM notebook serializer",
      ".cbs / conceptbase language attachment",
    ],
  },
] as const;
