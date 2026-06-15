/** LSP semantic token legend — indices must match {@link captureToTokenIndex}. */

export const SEMANTIC_TOKEN_TYPES = [
  "keyword",
  "function",
  "variable",
  "string",
  "number",
  "comment",
  "macro",
  "operator",
] as const;

export type SemanticTokenTypeName = (typeof SEMANTIC_TOKEN_TYPES)[number];

export const SEMANTIC_TOKEN_MODIFIERS = ["defaultLibrary"] as const;

export type SemanticTokenModifierName = (typeof SEMANTIC_TOKEN_MODIFIERS)[number];

/** tree-sitter highlights.scm capture name → LSP token type index. */
export const CAPTURE_TO_TYPE_INDEX: Record<string, number> = {
  keyword: 0,
  "keyword.control": 0,
  function: 1,
  "function.builtin": 1,
  variable: 2,
  string: 3,
  number: 4,
  comment: 5,
  embedded: 6,
  "constant.builtin": 4,
  "punctuation.special": 7,
};

/** Capture names that set the `defaultLibrary` modifier bit. */
export const DEFAULT_LIBRARY_CAPTURES = new Set(["function.builtin", "constant.builtin"]);

/** Higher priority wins when captures overlap at the same offset. */
export const CAPTURE_PRIORITY: Record<string, number> = {
  keyword: 100,
  "keyword.control": 100,
  "punctuation.special": 90,
  function: 85,
  "function.builtin": 84,
  string: 80,
  embedded: 75,
  number: 70,
  "constant.builtin": 70,
  variable: 60,
  comment: 50,
};

export function captureToTypeIndex(captureName: string): number | undefined {
  return CAPTURE_TO_TYPE_INDEX[captureName];
}

export function captureToModifiers(captureName: string): number {
  return DEFAULT_LIBRARY_CAPTURES.has(captureName) ? 1 << 0 : 0;
}
