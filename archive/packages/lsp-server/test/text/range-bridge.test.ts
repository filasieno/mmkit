import { expect } from "chai";
import { TextDocument } from "vscode-languageserver-textdocument";
import { indexToLspPosition, lspPositionToIndex, nodeToLspRange } from "../../src/lsp/text/range-bridge";
import { isTreeSitterAvailable, parseConceptBase } from "../../src/lsp/tree-sitter/runtime";
import { MSFOL_ASSERTION, UNICODE_FRAME } from "../fixtures/corpus";

describe("range-bridge LSP ↔ tree-sitter", function () {
  before(async function () {
    if (!(await isTreeSitterAvailable())) this.skip();
  });

  it("round-trips index through LSP position", () => {
    const text = UNICODE_FRAME;
    const doc = TextDocument.create("file:///r.cbs", "conceptbase", 1, text);
    const tree = parseConceptBase(text)!;
    const idx = tree.rootNode.startIndex;
    const pos = indexToLspPosition(doc, idx);
    expect(lspPositionToIndex(doc, pos)).to.equal(idx);
  });

  it("nodeToLspRange spans correct line for assertion on line 0", () => {
    const doc = TextDocument.create("file:///assert.cbs", "conceptbase", 1, MSFOL_ASSERTION);
    const tree = parseConceptBase(MSFOL_ASSERTION)!;
    const range = nodeToLspRange(doc, tree.rootNode);
    expect(range.start.line).to.equal(0);
    expect(doc.getText().slice(lspPositionToIndex(doc, range.start), lspPositionToIndex(doc, range.end))).to.equal(
      MSFOL_ASSERTION
    );
  });

  it("diagnostic range lines match tree node lines after mid-document insert", () => {
    const base = UNICODE_FRAME;
    const doc = TextDocument.create("file:///mid.cbs", "conceptbase", 1, base);
    const insert = "    note : String\n";
    const updated = TextDocument.update(
      doc,
      [{ range: { start: { line: 2, character: 4 }, end: { line: 2, character: 4 } }, text: insert }],
      2
    );
    const tree = parseConceptBase(updated.getText())!;
    const range = nodeToLspRange(updated, tree.rootNode);
    expect(range.start.line).to.equal(0);
    expect(range.end.line).to.be.greaterThan(2);
  });
});
