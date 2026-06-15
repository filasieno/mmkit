/**
 * Property-sheet metadata for {@link CBServerConfig}.
 *
 * Source of truth: {@link ./cbserver-settings.meta.yaml}
 * Generated export: {@link ./cbserver-settings.meta.gen.ts}
 */

/** When a setting change can be applied without restarting cbserver. */
export type CBServerSettingChangeClass = "hot" | "warm" | "cold";

export type CBServerSettingKind = "string" | "boolean" | "number" | "enum" | "string[]";

export type CBServerSettingGroup = "launch" | "network" | "paths" | "runtime" | "mmkit";

/** One selectable value for enum / constrained fields. */
export interface ICBServerSettingEnumOption {
  value: string | number | boolean;
  label: string;
  description?: string;
}

/**
 * Rich field descriptor for property grids, VS Code settings UI, and launch-spec builders.
 *
 * Text layers:
 * - `description` — short summary (property grid / list column)
 * - `tooltip` — hover hint (one or two sentences)
 * - `detailed` — markdown body (side panel / help viewer)
 */
export interface ICBServerSettingMeta {
  /** Dot path under {@link CBServerConfig}, e.g. `paths.dataDir`. */
  key: string;
  title: string;
  description: string;
  tooltip: string;
  detailed: string;
  kind: CBServerSettingKind;
  group: CBServerSettingGroup;
  /** UI subsection within the group tab. */
  section: string;
  /** Sort order within `section` (ascending). */
  order: number;
  defaultValue: unknown;
  changeClass: CBServerSettingChangeClass;
  /** When `true`, empty / undefined means omit the cbserver flag at launch. */
  optional?: boolean;
  enumOptions?: readonly ICBServerSettingEnumOption[];
  mapsToEnv?: string;
  mapsToCli?: string;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  pattern?: string;
  restartRequired?: boolean;
  scope?: "resource" | "application";
  /** Relative path into the ConceptBase.cc repo for deeper reading. */
  docRef?: string;
  examples?: readonly string[];
  /** Other `key` values that interact with this field. */
  related?: readonly string[];
  hidden?: boolean;
  readOnly?: boolean;
}

export interface ICBServerSettingGroupMeta {
  title: string;
  description: string;
  tooltip?: string;
  detailed?: string;
  order: number;
}

export interface ICBServerSettingsMetaDocument {
  schemaVersion: number;
  model: string;
  docRefs: {
    man?: string;
    userManual?: string;
    configuration?: string;
  };
  groups: Record<CBServerSettingGroup, ICBServerSettingGroupMeta>;
  fields: ICBServerSettingMeta[];
}

export { CB_SERVER_SETTING_META, CB_SERVER_SETTINGS_META_DOC } from "./cbserver-settings.meta.gen";
