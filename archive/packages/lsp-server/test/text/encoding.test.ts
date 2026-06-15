import { expect } from "chai";
import { TextDocument } from "vscode-languageserver-textdocument";
import {
  assertIndexEncodingContract,
  getLineText,
  utf16Length,
  utf8ByteLength,
} from "../../src/lsp/text/encoding";
import { isTreeSitterAvailable, parseConceptBase } from "../../src/lsp/tree-sitter/runtime";
import { UNICODE_FRAME } from "../fixtures/corpus";

describe("UTF-16 / tree-sitter encoding contract", function () {
  before(async function () {
    if (!(await isTreeSitterAvailable())) this.skip();
  });

  it("documents UTF-8 byte length differs from UTF-16 for non-ASCII", () => {
    const text = "José";
    expect(utf16Length(text)).to.equal(4);
    expect(utf8ByteLength(text)).to.equal(5);
  });

  it("supplementary plane emoji uses two UTF-16 code units", () => {
    const emoji = "😀";
    expect(utf16Length(emoji)).to.equal(2);
    expect(utf8ByteLength(emoji)).to.equal(4);
  });

  it("tree-sitter indices match LSP positions for unicode frame", () => {
    const doc = TextDocument.create("file:///unicode.cbs", "conceptbase", 1, UNICODE_FRAME);
    const tree = parseConceptBase(doc.getText())!;
    function walk(node: typeof tree.rootNode): void {
      assertIndexEncodingContract(doc, node, node.type);
      for (let i = 0; i < node.childCount; i++) {
        const c = node.child(i);
        if (c) walk(c);
      }
    }
    walk(tree.rootNode);
  });

  it("getLineText matches document lines after UTF-16 edits", () => {
    const doc = TextDocument.create("file:///lines.cbs", "conceptbase", 1, "a\nb\nc\n");
    expect(getLineText(doc, 0)).to.equal("a");
    expect(getLineText(doc, 1)).to.equal("b");
    expect(getLineText(doc, 2)).to.equal("c");
  });

  it("emoji in string_label keeps LSP/tree index alignment", () => {
    const text = 'X in Y with\n  attribute\n    tag : "😀"\nend\n';
    const doc = TextDocument.create("file:///emoji.cbs", "conceptbase", 1, text);
    const tree = parseConceptBase(text)!;
    let stringNode: typeof tree.rootNode | undefined;
    function find(node: typeof tree.rootNode): void {
      if (node.type === "string_label") stringNode = node;
      for (let i = 0; i < node.childCount; i++) {
        const c = node.child(i);
        if (c) find(c);
      }
    }
    find(tree.rootNode);
    expect(stringNode).to.exist;
    assertIndexEncodingContract(doc, stringNode!, "string_label");
    const slice = text.slice(stringNode!.startIndex, stringNode!.endIndex);
    expect(slice).to.equal('"😀"');
    expect(doc.positionAt(stringNode!.startIndex).character).to.equal(10);
  });
});
