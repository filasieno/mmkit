import type { TextDocument } from "vscode-languageserver-textdocument";
import type { ParseTree } from "./tree-sitter/runtime";

/**
 * ConceptBase buffer: LSP {@link TextDocument} plus an optional incremental
 * tree-sitter CST bound to the same URI and version.
 *
 * The CST is owned by {@link DocumentRegistry} (separate map); this type is the
 * unified read model returned to callers.
 */
export interface ConceptBaseDocument {
  readonly uri: string;
  /** LSP text buffer (UTF-16 positions, monotonic `version`). */
  readonly document: TextDocument;
  /** Mirrors `document.version` — registry rejects stale LSP versions. */
  readonly version: number;
  /** Incremental CST for `document` at `version`, or undefined before first parse / after close. */
  readonly tree: ParseTree | undefined;
}

export function toConceptBaseDocument(
  document: TextDocument,
  tree: ParseTree | undefined
): ConceptBaseDocument {
  return {
    uri: document.uri,
    document,
    version: document.version,
    tree,
  };
}
