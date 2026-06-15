import { expect } from "chai";
import { TextDocument } from "vscode-languageserver-textdocument";
import { buildServerCapabilities } from "../src/lsp/capabilities";
import { DocumentRegistry } from "../src/lsp/document-registry";
import { validateConceptBaseDocument } from "../src/lsp/parse";
import {
  encodeSemanticTokens,
  filterTokensInRange,
  prepareSemanticTokens,
} from "../src/lsp/semantic-tokens/encode";
import { CAPTURE_TO_TYPE_INDEX, SEMANTIC_TOKEN_MODIFIERS, SEMANTIC_TOKEN_TYPES } from "../src/lsp/semantic-tokens/legend";
import {
  provideSemanticTokensFull,
  provideSemanticTokensRange,
} from "../src/lsp/semantic-tokens/provider";
import { allHighlightTokens, loadHighlightsQuery } from "../src/lsp/tree-sitter/queries";
import { getLoadedLanguage, isTreeSitterAvailable, parseConceptBase } from "../src/lsp/tree-sitter/runtime";
import { EMPLOYEE_FRAME, MSFOL_ASSERTION, SIMPLE_ECARULE } from "./fixtures/corpus";
import { createCbsDocument } from "./helpers/edit-document";

describe("semantic tokens", function () {
  before(async function () {
    if (!(await isTreeSitterAvailable())) this.skip();
  });

  it("advertises semanticTokensProvider in server capabilities", () => {
    const caps = buildServerCapabilities();
    expect(caps.semanticTokensProvider).to.exist;
    const legend = caps.semanticTokensProvider!.legend;
    expect(legend.tokenTypes).to.deep.equal([...SEMANTIC_TOKEN_TYPES]);
    expect(legend.tokenModifiers).to.deep.equal([...SEMANTIC_TOKEN_MODIFIERS]);
    expect(caps.semanticTokensProvider!.full).to.equal(true);
    expect(caps.semanticTokensProvider!.range).to.equal(true);
  });

  it("maps every highlights capture used for semantic tokens", () => {
    for (const name of [
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
    ]) {
      expect(CAPTURE_TO_TYPE_INDEX[name], name).to.be.a("number");
    }
  });

  it("encodes Employee frame keywords with UTF-16 lengths", async () => {
    const uri = "file:///sem.cbs";
    const doc = createCbsDocument(uri, EMPLOYEE_FRAME, 1);
    const tree = parseConceptBase(EMPLOYEE_FRAME)!;
    const query = await loadHighlightsQuery(getLoadedLanguage());
    expect(query).to.exist;

    const raw = allHighlightTokens(doc, tree, query!).map((t) => ({ ...t, document: doc }));
    const prepared = prepareSemanticTokens(raw);
    const encoded = encodeSemanticTokens(doc, prepared);

    expect(prepared.length).to.be.greaterThan(5);
    expect(encoded.data.length % 5).to.equal(0);

    const keywordType = CAPTURE_TO_TYPE_INDEX.keyword;
    const keywordLengths = prepared.filter((t) => t.tokenType === keywordType).map((t) => t.endIndex - t.startIndex);
    expect(keywordLengths).to.include(2); // "in"
    expect(keywordLengths).to.include(4); // "with"
  });

  it("provideSemanticTokensFull returns data for open document", async () => {
    const uri = "file:///full.cbs";
    const reg = new DocumentRegistry();
    reg.trackOpen(createCbsDocument(uri, EMPLOYEE_FRAME, 1));
    const tokens = await provideSemanticTokensFull(reg, uri);
    expect(tokens.data.length).to.be.greaterThan(0);
  });

  it("provideSemanticTokensRange filters to viewport", async () => {
    const uri = "file:///range.cbs";
    const reg = new DocumentRegistry();
    const doc = createCbsDocument(uri, EMPLOYEE_FRAME, 1);
    reg.trackOpen(doc);
    await validateConceptBaseDocument(reg, doc);

    const full = await provideSemanticTokensFull(reg, uri);
    const ranged = await provideSemanticTokensRange(reg, uri, {
      start: { line: 0, character: 0 },
      end: { line: 0, character: 40 },
    });
    expect(ranged.data.length).to.be.greaterThan(0);
    expect(ranged.data.length).to.be.at.most(full.data.length);
  });

  it("returns empty tokens for unknown uri", async () => {
    const reg = new DocumentRegistry();
    const tokens = await provideSemanticTokensFull(reg, "file:///missing.cbs");
    expect(tokens.data).to.deep.equal([]);
  });

  it("returns empty tokens for whitespace-only buffer", async () => {
    const uri = "file:///blank.cbs";
    const reg = new DocumentRegistry();
    reg.trackOpen(createCbsDocument(uri, "   \n", 1));
    const tokens = await provideSemanticTokensFull(reg, uri);
    expect(tokens.data).to.deep.equal([]);
  });

  it("includes assertion controls in MSFOL snippet", async () => {
    const uri = "file:///msfol-sem.cbs";
    const reg = new DocumentRegistry();
    reg.trackOpen(createCbsDocument(uri, MSFOL_ASSERTION, 1));
    const tokens = await provideSemanticTokensFull(reg, uri);
    expect(tokens.data.length).to.be.greaterThan(0);
  });

  it("includes ECArule ON/IF/DO tokens", async () => {
    const uri = "file:///eca-sem.cbs";
    const reg = new DocumentRegistry();
    reg.trackOpen(createCbsDocument(uri, SIMPLE_ECARULE, 1));
    const tokens = await provideSemanticTokensFull(reg, uri);
    expect(tokens.data.length).to.be.greaterThan(3);
  });

  it("filterTokensInRange keeps tokens crossing range boundary", () => {
    const doc = TextDocument.create("file:///f.cbs", "conceptbase", 1, "aa\nbb\ncc\n");
    const tokens = [
      { startIndex: 0, endIndex: 2, tokenType: 0, tokenModifiers: 0 },
      { startIndex: 3, endIndex: 5, tokenType: 0, tokenModifiers: 0 },
      { startIndex: 6, endIndex: 8, tokenType: 0, tokenModifiers: 0 },
    ];
    const filtered = filterTokensInRange(doc, tokens, {
      start: { line: 0, character: 1 },
      end: { line: 1, character: 1 },
    });
    expect(filtered).to.have.length(2);
  });
});
