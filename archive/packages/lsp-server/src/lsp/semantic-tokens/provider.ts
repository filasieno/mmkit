import type { Range, SemanticTokens } from "vscode-languageserver/node";
import type { DocumentRegistry } from "../document-registry";
import { validateConceptBaseDocument } from "../parse";
import {
  allHighlightTokens,
  type HighlightToken,
  loadHighlightsQuery,
} from "../tree-sitter/queries";
import { getLoadedLanguage, isTreeSitterAvailable } from "../tree-sitter/runtime";
import { encodeSemanticTokens, filterTokensInRange, prepareSemanticTokens } from "./encode";

/** Attach `document` to tokens for index helpers during encoding. */
type TokenWithDoc = HighlightToken & { document: import("vscode-languageserver-textdocument").TextDocument };

export async function provideSemanticTokensFull(
  registry: DocumentRegistry,
  uri: string
): Promise<SemanticTokens> {
  const prepared = await collectEncodedTokens(registry, uri);
  if (!prepared) return { data: [] };
  return encodeSemanticTokens(prepared.doc, prepared.tokens);
}

export async function provideSemanticTokensRange(
  registry: DocumentRegistry,
  uri: string,
  range: Range
): Promise<SemanticTokens> {
  const prepared = await collectEncodedTokens(registry, uri);
  if (!prepared) return { data: [] };
  const filtered = filterTokensInRange(prepared.doc, prepared.tokens, range);
  return encodeSemanticTokens(prepared.doc, filtered);
}

async function collectEncodedTokens(
  registry: DocumentRegistry,
  uri: string
): Promise<{ doc: import("vscode-languageserver-textdocument").TextDocument; tokens: ReturnType<typeof prepareSemanticTokens> } | undefined> {
  const doc = registry.getBuffer(uri);
  if (!doc || doc.getText().trim().length === 0) return undefined;

  if (!(await isTreeSitterAvailable())) return undefined;

  await validateConceptBaseDocument(registry, doc);
  const tree = registry.getTree(uri);
  if (!tree) return undefined;

  const query = await loadHighlightsQuery(getLoadedLanguage());
  if (!query) return undefined;

  const raw = allHighlightTokens(doc, tree, query).map((t) => ({ ...t, document: doc }));
  const tokens = prepareSemanticTokens(raw);
  return { doc, tokens };
}
