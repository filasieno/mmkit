import type { Range } from "vscode-languageserver-types";
import { TextDocument } from "vscode-languageserver-textdocument";
import { LANGUAGE_ID } from "@mmkit/shared";

export interface TextEdit {
  range: Range;
  text: string;
}

/** Create a ConceptBase buffer at `uri` with initial `version`. */
export function createCbsDocument(uri: string, text: string, version = 1): TextDocument {
  return TextDocument.create(uri, LANGUAGE_ID, version, text);
}

/** Apply one or more incremental edits, bumping version once per edit batch step. */
export function applyEdits(doc: TextDocument, edits: TextEdit[], nextVersion?: number): TextDocument {
  const version = nextVersion ?? doc.version + 1;
  return TextDocument.update(doc, edits, version);
}

/** Apply a sequence of edit batches (simulates multiple LSP didChange notifications). */
export function applyEditSequence(
  doc: TextDocument,
  batches: TextEdit[][]
): TextDocument {
  let current = doc;
  for (const batch of batches) {
    current = applyEdits(current, batch, current.version + 1);
  }
  return current;
}

/** Insert `text` at a UTF-16 position. */
export function insertAt(doc: TextDocument, line: number, character: number, text: string): TextDocument {
  return applyEdits(doc, [{ range: { start: { line, character }, end: { line, character } }, text }]);
}

/** Delete the range `[start, end)` (end exclusive). */
export function deleteRange(
  doc: TextDocument,
  start: { line: number; character: number },
  end: { line: number; character: number }
): TextDocument {
  return applyEdits(doc, [{ range: { start, end }, text: "" }]);
}

/** Replace range with new text. */
export function replaceRange(
  doc: TextDocument,
  start: { line: number; character: number },
  end: { line: number; character: number },
  text: string
): TextDocument {
  return applyEdits(doc, [{ range: { start, end }, text }]);
}
