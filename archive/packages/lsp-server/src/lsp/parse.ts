import type { Diagnostic } from "vscode-languageserver/node";
import type { TextDocument } from "vscode-languageserver-textdocument";
import type { DocumentRegistry } from "./document-registry";
import { bracketDiagnostics, diagnosticsFromTree } from "./tree-sitter/diagnostics";
import { isTreeSitterAvailable, parseConceptBase } from "./tree-sitter/runtime";

export async function validateDocument(
  registry: DocumentRegistry,
  uri: string
): Promise<Diagnostic[]> {
  const entry = registry.getConceptBaseDocument(uri);
  if (!entry) return [];
  return validateConceptBaseDocument(registry, entry.document);
}

export async function validateConceptBaseDocument(
  registry: DocumentRegistry,
  doc: TextDocument
): Promise<Diagnostic[]> {
  const text = doc.getText();
  if (text.trim().length === 0) return [];

  const ready = await isTreeSitterAvailable();
  if (!ready) {
    return bracketDiagnostics(text, doc);
  }

  const previous = registry.getTree(doc.uri);
  const tree = parseConceptBase(text, previous);
  if (!tree) {
    registry.setTree(doc.uri, undefined);
    return bracketDiagnostics(text, doc);
  }

  registry.setTree(doc.uri, tree);
  const diagnostics = diagnosticsFromTree(tree.rootNode, doc);
  if (diagnostics.length === 0) {
    diagnostics.push(...bracketDiagnostics(text, doc));
  }
  return diagnostics;
}

/** @deprecated Use DocumentRegistry.trackClose */
export function clearDocumentTree(registry: DocumentRegistry, uri: string): void {
  registry.setTree(uri, undefined);
}
