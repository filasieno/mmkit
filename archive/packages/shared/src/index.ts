export * from "./constants";
export * from "./config";
export * from "./protocol";
export * from "./cb-tcp";
export * from "./cb-ask";
export * from "./executable-path";

/** ConceptBase language id registered with VS Code and the LSP server. */
export const LANGUAGE_ID = "conceptbase";

/** MM notebook type for ConceptBase-only code cells. */
export const NOTEBOOK_TYPE = "mmkit.conceptbase-notebook";

/** On-disk notebook extension. */
export const NOTEBOOK_EXTENSION = ".mmnb";

/** ConceptBase source file extension. */
export const CBS_EXTENSION = ".cbs";

/** TextMate / tree-sitter scope for ConceptBase sources. */
export const LANGUAGE_SCOPE = "source.conceptbase";

/** LSP text sync: incremental only (TextDocumentSyncKind.Incremental === 2). */
export const TEXT_DOCUMENT_SYNC_INCREMENTAL = 2 as const;

/** Current on-disk MM notebook JSON schema version. */
export const MMNB_VERSION = 1;

/** Virtual URI scheme for in-memory ConceptBase browser documents. */
export const NODE_EDITOR_SCHEME = "mmkit-node";

/** Custom editor view type for the ConceptBase browser (WebGL2 + Slug text). */
export const NODE_EDITOR_VIEW_TYPE = "mmkit.nodeEditor";

/** Virtual document extension shown in editor tabs. */
export const NODE_EDITOR_EXTENSION = ".cbn";

/** Command palette id — opens the default ConceptBase browser virtual document. */
export const NODE_EDITOR_COMMAND = "mmkit.openNodeEditor";
