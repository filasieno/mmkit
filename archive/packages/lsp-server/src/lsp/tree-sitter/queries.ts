import * as fs from "node:fs";
import * as path from "node:path";
import type { Range } from "vscode-languageserver-types";
import type { TextDocument } from "vscode-languageserver-textdocument";
import { nodeToLspRange } from "../text/range-bridge";
import type { ParseTree, SyntaxNode } from "./runtime";

interface QueryCapture {
  name: string;
  node: SyntaxNode;
}

interface QueryMatch {
  captures: QueryCapture[];
}

interface QueryInstance {
  matches(node: SyntaxNode): QueryMatch[];
}

interface LanguageWithQuery {
  load(wasmPath: string): Promise<unknown>;
}

interface QueryConstructor {
  new (language: unknown, source: string): QueryInstance;
}

let highlightsQuery: QueryInstance | undefined;
let highlightsSource: string | undefined;

function highlightsCandidates(): string[] {
  const here = path.dirname(__filename);
  const rel = "tree-sitter-conceptbase/source/queries/highlights.scm";
  return [
    path.resolve(here, "../../../../../../", rel),
    path.resolve(here, "../../../../../../../", rel),
    path.resolve(here, "../../../../../", rel),
  ];
}

export function resolveHighlightsQueryPath(): string | undefined {
  for (const candidate of highlightsCandidates()) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return undefined;
}

export async function loadHighlightsQuery(language: unknown): Promise<QueryInstance | undefined> {
  if (highlightsQuery) return highlightsQuery;
  const queryPath = resolveHighlightsQueryPath();
  if (!queryPath) return undefined;
  highlightsSource = fs.readFileSync(queryPath, "utf8");
  const { Query } = (await import("web-tree-sitter")) as { Query: QueryConstructor };
  highlightsQuery = new Query(language, highlightsSource);
  return highlightsQuery;
}

export function getHighlightsQuerySource(): string | undefined {
  return highlightsSource;
}

/** Semantic-token–ready capture with LSP range (UTF-16). */
export interface HighlightToken {
  captureName: string;
  text: string;
  range: Range;
  nodeType: string;
}

/**
 * Run highlights.scm captures filtered by name (e.g. `keyword`, `keyword.control`).
 * Prepares semantic token wiring: capture name → token type legend.
 */
export function capturesByName(
  doc: TextDocument,
  tree: ParseTree,
  query: QueryInstance,
  captureNames: Set<string>
): HighlightToken[] {
  const tokens: HighlightToken[] = [];
  for (const match of query.matches(tree.rootNode)) {
    for (const cap of match.captures) {
      if (!captureNames.has(cap.name)) continue;
      tokens.push({
        captureName: cap.name,
        text: doc.getText().slice(cap.node.startIndex, cap.node.endIndex),
        range: nodeToLspRange(doc, cap.node),
        nodeType: cap.node.type,
      });
    }
  }
  return tokens;
}

/** Keyword captures from highlights.scm `@keyword` / `@keyword.control`. */
export function keywordTokens(doc: TextDocument, tree: ParseTree, query: QueryInstance): HighlightToken[] {
  return capturesByName(doc, tree, query, new Set(["keyword", "keyword.control"]));
}

/** All highlights.scm capture names used for semantic tokens. */
export const SEMANTIC_CAPTURE_NAMES = new Set([
  "comment",
  "keyword",
  "keyword.control",
  "function",
  "function.builtin",
  "punctuation.special",
  "string",
  "embedded",
  "variable",
  "number",
  "constant.builtin",
]);

/** Every semantic-token capture from highlights.scm. */
export function allHighlightTokens(doc: TextDocument, tree: ParseTree, query: QueryInstance): HighlightToken[] {
  return capturesByName(doc, tree, query, SEMANTIC_CAPTURE_NAMES);
}

/** @internal tests */
export function _resetQueriesForTests(): void {
  highlightsQuery = undefined;
  highlightsSource = undefined;
}
