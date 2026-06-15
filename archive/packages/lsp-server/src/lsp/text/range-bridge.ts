import type { Range } from "vscode-languageserver-types";
import type { TextDocument } from "vscode-languageserver-textdocument";
import { assertIndexEncodingContract, type TreeIndexable } from "./encoding";

/**
 * Map a tree-sitter node to an LSP {@link Range} via UTF-16 indices only.
 * Line/character come from {@link TextDocument.positionAt} — no tree-sitter row lookup.
 */
export function nodeToLspRange(doc: TextDocument, node: TreeIndexable): Range {
  assertIndexEncodingContract(doc, node);
  return {
    start: doc.positionAt(node.startIndex),
    end: doc.positionAt(node.endIndex),
  };
}

/** Map tree-sitter byte/code-unit index to LSP position (UTF-16). */
export function indexToLspPosition(doc: TextDocument, index: number) {
  return doc.positionAt(index);
}

/** Map LSP position to index for tree-sitter edit alignment. */
export function lspPositionToIndex(doc: TextDocument, position: { line: number; character: number }): number {
  return doc.offsetAt(position);
}
