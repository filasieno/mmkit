import type { Diagnostic } from "vscode-languageserver/node";
import { DiagnosticSeverity } from "vscode-languageserver/node";
import type { TextDocument } from "vscode-languageserver-textdocument";
import { indexToLspPosition, nodeToLspRange } from "../text/range-bridge";
import type { SyntaxNode } from "./runtime";

function walkErrors(node: SyntaxNode, doc: TextDocument, out: Diagnostic[]): void {
  if (node.hasError || node.type === "ERROR") {
    const range = nodeToLspRange(doc, node);
    out.push({
      severity: DiagnosticSeverity.Error,
      range,
      message: node.isMissing ? `Missing ${node.type}` : "Syntax error",
      source: "conceptbase",
    });
  }
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child) walkErrors(child, doc, out);
  }
}

/** Bracket/string-aware fallback when tree-sitter is unavailable. Uses UTF-16 indices. */
export function bracketDiagnostics(text: string, doc: TextDocument): Diagnostic[] {
  const stack: Array<{ ch: string; index: number }> = [];
  const pairs: Record<string, string> = { "(": ")", "[": "]" };
  const closers = new Set(Object.values(pairs));
  const diagnostics: Diagnostic[] = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"' || ch === "'") {
      const quote = ch;
      i++;
      while (i < text.length && text[i] !== quote) {
        if (text[i] === "\\") i++;
        i++;
      }
      continue;
    }
    if (pairs[ch]) {
      stack.push({ ch, index: i });
      continue;
    }
    if (closers.has(ch)) {
      const open = stack.pop();
      if (!open || pairs[open.ch] !== ch) {
        const start = indexToLspPosition(doc, i);
        diagnostics.push({
          severity: DiagnosticSeverity.Error,
          range: { start, end: { line: start.line, character: start.character + 1 } },
          message: `Unexpected '${ch}'`,
          source: "conceptbase",
        });
      }
    }
  }

  for (const open of stack) {
    const start = indexToLspPosition(doc, open.index);
    diagnostics.push({
      severity: DiagnosticSeverity.Error,
      range: { start, end: { line: start.line, character: start.character + 1 } },
      message: `Unclosed '${open.ch}'`,
      source: "conceptbase",
    });
  }

  return diagnostics;
}

export function diagnosticsFromTree(root: SyntaxNode, doc: TextDocument): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  walkErrors(root, doc, diagnostics);
  return diagnostics;
}
