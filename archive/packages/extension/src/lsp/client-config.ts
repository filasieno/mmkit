import { LANGUAGE_ID, NOTEBOOK_TYPE } from "@mmkit/shared";

/** Document selectors for ConceptBase buffers (files + notebook cells). */
export function buildDocumentSelector() {
  return [
    { language: LANGUAGE_ID, scheme: "file" as const },
    { language: LANGUAGE_ID, scheme: "vscode-notebook-cell" as const },
    { notebook: NOTEBOOK_TYPE, language: LANGUAGE_ID },
  ];
}

export type LspTraceSetting = "off" | "messages" | "verbose";

/** Map `mmkit.languageServer.trace` setting to a normalized value. */
export function normalizeLspTraceSetting(level: string | undefined): LspTraceSetting {
  switch (level) {
    case "verbose":
      return "verbose";
    case "messages":
      return "messages";
    default:
      return "off";
  }
}
