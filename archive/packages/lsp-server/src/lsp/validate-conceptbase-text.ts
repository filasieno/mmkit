import { TextDocument } from "vscode-languageserver-textdocument";
import { bracketDiagnostics } from "./tree-sitter/diagnostics";
import { countSyntaxErrors, isTreeSitterAvailable, parseConceptBase } from "./tree-sitter/runtime";

export interface ConceptBaseValidationIssue {
  message: string;
  line?: number;
  character?: number;
}

export interface ConceptBaseValidationResult {
  ok: boolean;
  issues: ConceptBaseValidationIssue[];
  parser: "tree-sitter" | "bracket-fallback" | "empty";
}

const MAX_FRAME_BYTES = 512_000;

export async function validateConceptBaseText(text: string): Promise<ConceptBaseValidationResult> {
  if (text.length === 0) {
    return { ok: false, issues: [{ message: "empty input" }], parser: "empty" };
  }
  if (Buffer.byteLength(text, "utf8") > MAX_FRAME_BYTES) {
    return {
      ok: false,
      issues: [{ message: `input exceeds ${MAX_FRAME_BYTES} bytes` }],
      parser: "empty",
    };
  }

  const ready = await isTreeSitterAvailable();
  if (ready) {
    const tree = parseConceptBase(text);
    if (!tree) {
      return {
        ok: false,
        issues: [{ message: "tree-sitter parse failed" }],
        parser: "tree-sitter",
      };
    }
    const errorCount = countSyntaxErrors(tree.rootNode);
    if (errorCount > 0) {
      return {
        ok: false,
        issues: [{ message: `syntax errors in ConceptBase source (${errorCount} ERROR node(s))` }],
        parser: "tree-sitter",
      };
    }
    return { ok: true, issues: [], parser: "tree-sitter" };
  }

  const doc = TextDocument.create("mcp://inline", "conceptbase", 1, text);
  const diags = bracketDiagnostics(text, doc);
  if (diags.length > 0) {
    return {
      ok: false,
      issues: diags.map((d) => ({
        message: d.message,
        line: d.range.start.line,
        character: d.range.start.character,
      })),
      parser: "bracket-fallback",
    };
  }
  return { ok: true, issues: [], parser: "bracket-fallback" };
}
