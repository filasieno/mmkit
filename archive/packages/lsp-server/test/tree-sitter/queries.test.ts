import * as fs from "node:fs";
import * as path from "node:path";
import { expect } from "chai";
import { TextDocument } from "vscode-languageserver-textdocument";
import { DocumentRegistry } from "../../src/lsp/document-registry";
import { validateConceptBaseDocument } from "../../src/lsp/parse";
import { lspPositionToIndex } from "../../src/lsp/text/range-bridge";
import {
  capturesByName,
  keywordTokens,
  loadHighlightsQuery,
  resolveHighlightsQueryPath,
} from "../../src/lsp/tree-sitter/queries";
import {
  getLoadedLanguage,
  isTreeSitterAvailable,
  parseConceptBase,
} from "../../src/lsp/tree-sitter/runtime";
import { EMPLOYEE_FRAME, MSFOL_ASSERTION, SIMPLE_ECARULE } from "../fixtures/corpus";

describe("tree-sitter queries (semantic-token prep)", function () {
  before(async function () {
    if (!(await isTreeSitterAvailable())) this.skip();
  });

  it("resolves highlights.scm from tree-sitter-conceptbase", () => {
    expect(resolveHighlightsQueryPath()).to.be.a("string");
    expect(fs.readFileSync(resolveHighlightsQueryPath()!, "utf8")).to.contain("@keyword");
  });

  it("keywords query captures telos frame keywords on correct lines", async () => {
    const lang = getLoadedLanguage();
    expect(lang).to.exist;
    const query = await loadHighlightsQuery(lang);
    expect(query).to.exist;
    const doc = TextDocument.create("file:///telos.cbs", "conceptbase", 1, EMPLOYEE_FRAME);
    const tree = parseConceptBase(EMPLOYEE_FRAME)!;
    const tokens = keywordTokens(doc, tree, query!);

    const byText = new Map(tokens.map((t) => [t.text, t]));
    expect(byText.get("in")!.range.start.line).to.equal(0);
    expect(byText.get("with")!.range.start.line).to.equal(0);
    expect(byText.get("end")!.range.start.line).to.equal(3);

    for (const t of tokens) {
      const slice = doc.getText().slice(
        lspPositionToIndex(doc, t.range.start),
        lspPositionToIndex(doc, t.range.end)
      );
      expect(slice).to.equal(t.text);
    }
  });

  it("keywords query captures assertion controls", async () => {
    const query = await loadHighlightsQuery(getLoadedLanguage());
    expect(query).to.exist;
    const doc = TextDocument.create("file:///msfol.cbs", "conceptbase", 1, MSFOL_ASSERTION);
    const tree = parseConceptBase(MSFOL_ASSERTION)!;
    const controls = capturesByName(doc, tree, query!, new Set(["keyword.control"]));
    const names = controls.map((c) => c.text.toLowerCase());
    expect(names).to.include("forall");
    expect(names).to.include("exists");
  });

  it("keywords query captures ECArule ON/IF/DO controls", async () => {
    const query = await loadHighlightsQuery(getLoadedLanguage());
    expect(query).to.exist;
    const doc = TextDocument.create("file:///eca.cbs", "conceptbase", 1, SIMPLE_ECARULE);
    const tree = parseConceptBase(SIMPLE_ECARULE)!;
    const controls = capturesByName(doc, tree, query!, new Set(["keyword.control"]));
    const texts = new Set(controls.map((c) => c.text));
    expect(texts.has("ON") || texts.has("on")).to.equal(true);
    expect(texts.has("IF") || texts.has("if")).to.equal(true);
    expect(texts.has("DO") || texts.has("do")).to.equal(true);
  });

  it("explicit keywords.scm fixture loads and matches @keyword", async () => {
    const lang = getLoadedLanguage();
    expect(lang).to.exist;
    const fixture = path.join(__dirname, "../../../test/fixtures/queries/keywords.scm");
    const { Query } = await import("web-tree-sitter");
    const source = fs.readFileSync(fixture, "utf8");
    const query = new Query(lang as import("web-tree-sitter").Language, source);
    const doc = TextDocument.create("file:///kw.cbs", "conceptbase", 1, EMPLOYEE_FRAME);
    const tree = parseConceptBase(EMPLOYEE_FRAME)!;
    const kws = capturesByName(doc, tree, query, new Set(["keyword"]));
    expect(kws.map((k) => k.text).sort()).to.deep.equal(["end", "in", "with"]);
  });

  it("diagnostics publisher path: validate after edit still queryable", async () => {
    const uri = "file:///diag.cbs";
    const reg = new DocumentRegistry();
    let doc = TextDocument.create(uri, "conceptbase", 1, EMPLOYEE_FRAME);
    reg.trackOpen(doc);
    await validateConceptBaseDocument(reg, doc);
    doc = TextDocument.update(
      doc,
      [{ range: { start: { line: 0, character: 8 }, end: { line: 0, character: 8 } }, text: "X" }],
      2
    );
    reg.trackSyncedDocument(doc);
    const diags = await validateConceptBaseDocument(reg, doc);
    expect(diags).to.be.an("array");
    const query = await loadHighlightsQuery(getLoadedLanguage());
    expect(query).to.exist;
    const tree = reg.getTree(uri)!;
    expect(keywordTokens(doc, tree, query!).length).to.be.greaterThan(0);
  });
});
