import type { ChangeClass } from "./types";

/**
 * Metadata for one VS Code setting.
 *
 * Source of truth for `contributes.configuration` generation via
 * `npm run sync-contributes`. Maps to {@link @mmkit/base} runtime fields in
 * `read-configuration.ts` and `to-server-config.ts`.
 */
export interface FieldMeta {
  /** Full setting id, e.g. `mmkit.server.port`. */
  key: string;
  /** Settings UI label. */
  title: string;
  /** Short description shown in the settings list. */
  description: string;
  /**
   * Rich markdown for the setting detail pane (expanded help / tooltip).
   * Synced to `markdownDescription` in `package.json`.
   */
  markdownDescription?: string;
  type: "string" | "boolean" | "number" | "array";
  default: unknown;
  enum?: string[];
  /** Per-enum-value help text (parallel to `enum`). */
  enumDescriptions?: string[];
  scope?: "resource" | "application";
  /** Relative order within the settings category. */
  order?: number;
  /** ConfigActor restart classification (extension-only metadata). */
  changeClass: ChangeClass;
  category: "general" | "server" | "client";
}
