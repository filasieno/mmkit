/**
 * Line model backed solely by {@link TextDocument} (LSP buffer).
 *
 * `vscode-languageserver-textdocument` maintains incremental `_lineOffsets` on each
 * `TextDocument.update()` — line count and `offsetAt`/`positionAt` never require a
 * tree-sitter re-parse or a full `split('\n')` rescan of the buffer.
 */

import type { Position } from "vscode-languageserver-types";
import type { TextDocument } from "vscode-languageserver-textdocument";
import { getLineText, utf16Length } from "./encoding";

/** O(1) line count from the open buffer — no CST parse. */
export function getLineCount(doc: TextDocument): number {
  return doc.lineCount;
}

/** UTF-16 length of line `line` (content only, no trailing newline). */
export function getLineLength(doc: TextDocument, line: number): number {
  return utf16Length(getLineText(doc, line));
}

/**
 * Validate an LSP position against buffer line bounds.
 * `character` may equal line length (insert-after-last-char / exclusive range end).
 */
export function validateLinePosition(doc: TextDocument, position: Position): string | undefined {
  const { line, character } = position;
  if (line < 0 || line >= doc.lineCount) {
    return `line ${line} out of range (lineCount=${doc.lineCount})`;
  }
  if (character < 0) {
    return `character ${character} must be non-negative`;
  }
  const lineLen = getLineLength(doc, line);
  if (character > lineLen) {
    return `character ${character} past end of line ${line} (length=${lineLen})`;
  }
  return undefined;
}
