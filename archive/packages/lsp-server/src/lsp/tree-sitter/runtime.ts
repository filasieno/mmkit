import * as fs from "node:fs";
import * as path from "node:path";

/** Minimal tree-sitter syntax node surface used by the LSP server. */
export interface SyntaxNode {
  readonly type: string;
  readonly startIndex: number;
  readonly endIndex: number;
  readonly startPosition: { readonly row: number; readonly column: number };
  readonly endPosition: { readonly row: number; readonly column: number };
  readonly childCount: number;
  readonly hasError: boolean;
  readonly isMissing: boolean;
  child(index: number): SyntaxNode | null;
}

/** Incremental tree-sitter parse tree (CST). */
export interface ParseTree {
  readonly rootNode: SyntaxNode;
}

interface TreeSitterParser {
  setLanguage(language: unknown): void;
  parse(input: string, oldTree?: ParseTree): ParseTree;
}

interface TreeSitterLanguageStatic {
  load(wasmPath: string): Promise<unknown>;
}

interface TreeSitterParserStatic {
  init(): Promise<void>;
  new (): TreeSitterParser;
}

let parserReady: Promise<boolean> | undefined;
let parserUnavailable = false;
let ParserCtor: TreeSitterParserStatic | undefined;
let LanguageLoader: TreeSitterLanguageStatic | undefined;
let language: unknown;
let parser: TreeSitterParser | undefined;

export function getLoadedLanguage(): unknown | undefined {
  return language;
}

function wasmCandidates(): string[] {
  const here = path.dirname(__filename);
  const grammarWasm =
    "tree-sitter-conceptbase/target/lib/tree-sitter-conceptbase.wasm";
  return [
    path.join(here, "tree-sitter-conceptbase.wasm"),
    path.join(here, "..", "tree-sitter-conceptbase.wasm"),
    path.resolve(here, "../../../../../", grammarWasm),
    path.resolve(here, "../../../../../../", grammarWasm),
    path.resolve(here, "../../../../../../../", grammarWasm),
  ];
}

export function resolveWasmPath(): string | undefined {
  for (const candidate of wasmCandidates()) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return undefined;
}

/** Returns true when the ConceptBase WASM grammar loaded successfully. */
export async function isTreeSitterAvailable(): Promise<boolean> {
  if (parserUnavailable) return false;
  if (parser && language) return true;
  if (!parserReady) {
    parserReady = (async () => {
      try {
        const wasmPath = resolveWasmPath();
        if (!wasmPath) return false;
        const imported = (await import("web-tree-sitter")) as {
          Parser: TreeSitterParserStatic;
          Language: TreeSitterLanguageStatic;
          default?: { Parser: TreeSitterParserStatic; Language: TreeSitterLanguageStatic };
        };
        const mod = imported.default ?? imported;
        ParserCtor = mod.Parser;
        LanguageLoader = mod.Language;
        await ParserCtor.init();
        language = await LanguageLoader.load(wasmPath);
        parser = new ParserCtor();
        parser.setLanguage(language);
        return true;
      } catch {
        parserUnavailable = true;
        parser = undefined;
        language = undefined;
        return false;
      }
    })();
  }
  return parserReady;
}

/** Incrementally parse `text`, reusing `previousTree` when provided. */
export function parseConceptBase(text: string, previousTree?: ParseTree): ParseTree | undefined {
  if (!parser || parserUnavailable) return undefined;
  try {
    return parser.parse(text, previousTree);
  } catch {
    parserUnavailable = true;
    return undefined;
  }
}

/** Walk the tree and collect node type names (for tests). */
export function collectNodeTypes(root: SyntaxNode, out = new Set<string>()): Set<string> {
  out.add(root.type);
  for (let i = 0; i < root.childCount; i++) {
    const child = root.child(i);
    if (child) collectNodeTypes(child, out);
  }
  return out;
}

/** Count ERROR / missing nodes in the CST. */
export function countSyntaxErrors(root: SyntaxNode): number {
  let n = 0;
  if (root.hasError || root.type === "ERROR" || root.isMissing) n += 1;
  for (let i = 0; i < root.childCount; i++) {
    const child = root.child(i);
    if (child) n += countSyntaxErrors(child);
  }
  return n;
}

/** Reset runtime state (tests only). */
export function _resetTreeSitterRuntimeForTests(): void {
  parserReady = undefined;
  parserUnavailable = false;
  ParserCtor = undefined;
  LanguageLoader = undefined;
  language = undefined;
  parser = undefined;
}
