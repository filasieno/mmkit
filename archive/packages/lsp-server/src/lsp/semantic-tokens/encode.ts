import type { Range, SemanticTokens } from "vscode-languageserver/node";
import { SemanticTokensBuilder } from "vscode-languageserver/node";
import type { TextDocument } from "vscode-languageserver-textdocument";
import { lspPositionToIndex } from "../text/range-bridge";
import type { HighlightToken } from "../tree-sitter/queries";
import { captureToModifiers, captureToTypeIndex, CAPTURE_PRIORITY } from "./legend";

export interface EncodedSemanticToken {
  startIndex: number;
  endIndex: number;
  tokenType: number;
  tokenModifiers: number;
}

interface PrioritizedSemanticToken extends EncodedSemanticToken {
  priority: number;
}

type HighlightTokenWithDoc = HighlightToken & { document: TextDocument };

/** Sort by position and drop overlaps, keeping higher-priority captures. */
export function prepareSemanticTokens(tokens: HighlightTokenWithDoc[]): EncodedSemanticToken[] {
  const encoded: PrioritizedSemanticToken[] = [];
  for (const token of tokens) {
    const typeIndex = captureToTypeIndex(token.captureName);
    if (typeIndex === undefined) continue;
    const startIndex = lspPositionToIndex(token.document, token.range.start);
    const endIndex = lspPositionToIndex(token.document, token.range.end);
    if (endIndex <= startIndex) continue;
    encoded.push({
      startIndex,
      endIndex,
      tokenType: typeIndex,
      tokenModifiers: captureToModifiers(token.captureName),
      priority: CAPTURE_PRIORITY[token.captureName] ?? 0,
    });
  }

  encoded.sort(
    (a, b) =>
      a.startIndex - b.startIndex ||
      b.priority - a.priority ||
      a.endIndex - b.endIndex
  );

  const out: PrioritizedSemanticToken[] = [];
  let lastEnd = -1;
  for (const token of encoded) {
    if (token.startIndex < lastEnd) continue;
    out.push(token);
    lastEnd = token.endIndex;
  }
  return out.map(({ priority: _priority, ...rest }) => rest);
}

/** Build LSP `SemanticTokens` data array from prepared tokens. */
export function encodeSemanticTokens(doc: TextDocument, tokens: EncodedSemanticToken[]): SemanticTokens {
  const builder = new SemanticTokensBuilder();
  for (const token of tokens) {
    const start = doc.positionAt(token.startIndex);
    const length = token.endIndex - token.startIndex;
    builder.push(start.line, start.character, length, token.tokenType, token.tokenModifiers);
  }
  return builder.build();
}

/** Keep tokens intersecting `range` (LSP range, UTF-16). */
export function filterTokensInRange(
  doc: TextDocument,
  tokens: EncodedSemanticToken[],
  range: Range
): EncodedSemanticToken[] {
  const rangeStart = lspPositionToIndex(doc, range.start);
  const rangeEnd = lspPositionToIndex(doc, range.end);
  return tokens.filter((t) => t.startIndex < rangeEnd && t.endIndex > rangeStart);
}
