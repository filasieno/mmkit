/**
 * Single-extension manifest — documents every app plugin in the one `mmkit` VSIX.
 * Safe to import from unit tests (no `vscode` dependency).
 */

export const CONFIG_PLUGIN_ID = "mmkit.config";

export const MMKIT_PLUGIN_IDS = [CONFIG_PLUGIN_ID] as const;

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
    id: CONFIG_PLUGIN_ID,
    features: [
      "property sheet schema (FIELD_REGISTRY)",
      "VS Code contributes.configuration sync",
      "mmkit.openSettings command",
      "readMmkitConfiguration helper",
    ],
  },
] as const;
