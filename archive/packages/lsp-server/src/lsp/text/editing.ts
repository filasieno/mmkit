import type { TextDocument, TextDocumentContentChangeEvent } from "vscode-languageserver-textdocument";
import { TextDocument as TextDocumentImpl } from "vscode-languageserver-textdocument";
import type { Range } from "vscode-languageserver-types";
import {
  DocumentRegistry,
  type VersionSyncResult,
} from "../document-registry";
import { getLineText, utf16Length } from "./encoding";
import { getLineCount, validateLinePosition } from "./lines";

export interface LspTextEdit {
  range: Range;
  text: string;
}

/**
 * UTF-16–aware incremental editing on top of {@link DocumentRegistry}.
 *
 * All ranges use LSP semantics (UTF-16 code units). Tree-sitter re-parse uses the
 * updated `document.getText()`; CST indices remain aligned when parsing the same string.
 */
export class TextEditingFramework {
  constructor(private readonly registry: DocumentRegistry) {}

  open(document: TextDocument): VersionSyncResult {
    return this.registry.trackOpen(document);
  }

  close(uri: string): void {
    this.registry.trackClose(uri);
  }

  /**
   * Apply one LSP `contentChanges` batch. Validates UTF-16 range bounds before update.
   */
  applyEdits(
    uri: string,
    edits: LspTextEdit[],
    nextVersion: number
  ): VersionSyncResult {
    const current = this.registry.getBuffer(uri);
    if (!current) return { ok: false, reason: "unknown-uri" };

    const changes: TextDocumentContentChangeEvent[] = [];
    for (const edit of edits) {
      const err = validateUtf16Range(current, edit.range);
      if (err) throw new Error(`Invalid UTF-16 edit range: ${err}`);
      changes.push({ range: edit.range, text: edit.text });
    }

    return this.registry.trackChange(uri, changes, nextVersion);
  }

  /** Insert at UTF-16 (line, character). */
  insertAt(
    uri: string,
    line: number,
    character: number,
    text: string,
    nextVersion?: number
  ): VersionSyncResult {
    const current = this.registry.getBuffer(uri);
    if (!current) return { ok: false, reason: "unknown-uri" };
    const version = nextVersion ?? current.version + 1;
    return this.applyEdits(
      uri,
      [{ range: { start: { line, character }, end: { line, character } }, text }],
      version
    );
  }

  /** Delete UTF-16 range [start, end). */
  deleteRange(
    uri: string,
    start: { line: number; character: number },
    end: { line: number; character: number },
    nextVersion?: number
  ): VersionSyncResult {
    const current = this.registry.getBuffer(uri);
    if (!current) return { ok: false, reason: "unknown-uri" };
    const version = nextVersion ?? current.version + 1;
    return this.applyEdits(uri, [{ range: { start, end }, text: "" }], version);
  }

  getDocument(uri: string): TextDocument | undefined {
    return this.registry.getBuffer(uri);
  }

  /** Line text from the LSP buffer — never triggers tree-sitter parse. */
  getLine(uri: string, line: number): string | undefined {
    const doc = this.registry.getBuffer(uri);
    if (!doc || line < 0 || line >= getLineCount(doc)) return undefined;
    return getLineText(doc, line);
  }

  /** O(1) line count from buffer cache — never triggers tree-sitter parse. */
  getLineCount(uri: string): number | undefined {
    const doc = this.registry.getBuffer(uri);
    return doc ? getLineCount(doc) : undefined;
  }

  getRegistry(): DocumentRegistry {
    return this.registry;
  }
}

/** Ensure range endpoints are valid UTF-16 offsets within the document (buffer-only). */
export function validateUtf16Range(doc: TextDocument, range: Range): string | undefined {
  const startErr = validateLinePosition(doc, range.start);
  if (startErr) return startErr;
  const endErr = validateLinePosition(doc, range.end);
  if (endErr) return endErr;

  const text = doc.getText();
  const len = utf16Length(text);
  const start = doc.offsetAt(range.start);
  const end = doc.offsetAt(range.end);
  if (start < 0 || end < 0 || start > len || end > len || start > end) {
    return `out of bounds start=${start} end=${end} len=${len}`;
  }
  return undefined;
}

/** Build a new in-memory document after edits (test helper sharing framework rules). */
export function applyEditsToDocument(
  doc: TextDocument,
  edits: LspTextEdit[],
  nextVersion?: number
): TextDocument {
  for (const edit of edits) {
    const err = validateUtf16Range(doc, edit.range);
    if (err) throw new Error(err);
  }
  return TextDocumentImpl.update(
    doc,
    edits.map((e) => ({ range: e.range, text: e.text })),
    nextVersion ?? doc.version + 1
  );
}
