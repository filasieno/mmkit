import { expect } from "chai";
import { TextDocument } from "vscode-languageserver-textdocument";
import {
  assertIndexEncodingContract,
  getLineText,
  lineSlice,
  positionEquals,
  utf16Length,
} from "../../src/lsp/text/encoding";
import { applyEditsToDocument } from "../../src/lsp/text/editing";

describe("encoding helpers (extended)", () => {
  const uri = "file:///enc.cbs";

  it("positionEquals distinguishes line and character", () => {
    expect(positionEquals({ line: 0, character: 0 }, { line: 0, character: 0 })).to.equal(true);
    expect(positionEquals({ line: 0, character: 1 }, { line: 0, character: 0 })).to.equal(false);
    expect(positionEquals({ line: 1, character: 0 }, { line: 0, character: 0 })).to.equal(false);
  });

  it("lineSlice single line substring", () => {
    const doc = TextDocument.create(uri, "conceptbase", 1, "hello world");
    expect(lineSlice(doc, 0, 0, 0, 5)).to.equal("hello");
    expect(lineSlice(doc, 0, 6, 0, 11)).to.equal("world");
  });

  it("lineSlice across two lines includes newline", () => {
    const doc = TextDocument.create(uri, "conceptbase", 1, "ab\ncd\n");
    expect(lineSlice(doc, 0, 1, 1, 1)).to.equal("b\nc");
  });

  it("getLineText strips LF newline", () => {
    const doc = TextDocument.create(uri, "conceptbase", 1, "first\nsecond\n");
    expect(getLineText(doc, 0)).to.equal("first");
    expect(getLineText(doc, 1)).to.equal("second");
  });

  it("getLineText strips CRLF newline", () => {
    const doc = TextDocument.create(uri, "conceptbase", 1, "first\r\nsecond\r\n");
    expect(getLineText(doc, 0)).to.equal("first");
    expect(getLineText(doc, 1)).to.equal("second");
  });

  it("getLineText on final line without trailing newline", () => {
    const doc = TextDocument.create(uri, "conceptbase", 1, "only");
    expect(getLineText(doc, 0)).to.equal("only");
  });

  it("assertIndexEncodingContract throws on out-of-bounds indices", () => {
    const doc = TextDocument.create(uri, "conceptbase", 1, "hi");
    expect(() =>
      assertIndexEncodingContract(doc, { startIndex: 0, endIndex: 99 })
    ).to.throw(/out of bounds/);
  });

  it("assertIndexEncodingContract throws on inverted range", () => {
    const doc = TextDocument.create(uri, "conceptbase", 1, "hi");
    expect(() =>
      assertIndexEncodingContract(doc, { startIndex: 2, endIndex: 1 })
    ).to.throw(/out of bounds/);
  });

  it("assertIndexEncodingContract accepts valid index range", () => {
    const doc = TextDocument.create(uri, "conceptbase", 1, "hello");
    assertIndexEncodingContract(doc, { startIndex: 1, endIndex: 4 });
    expect(lineSlice(doc, 0, 1, 0, 4)).to.equal("ell");
  });

  it("utf16Length matches string.length for BMP and supplementary", () => {
    expect(utf16Length("abc")).to.equal(3);
    expect(utf16Length("😀")).to.equal(2);
    expect(utf16Length("a😀b")).to.equal(4);
  });

  const editRoundTrips: Array<{ before: string; range: { start: { line: number; character: number }; end: { line: number; character: number } }; text: string; after: string }> = [
    { before: "x", range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } }, text: "y", after: "y" },
    { before: "ab\ncd\n", range: { start: { line: 0, character: 1 }, end: { line: 1, character: 1 } }, text: "Z", after: "aZd\n" },
    { before: 'n : "😀"\n', range: { start: { line: 0, character: 5 }, end: { line: 0, character: 7 } }, text: "🎉", after: 'n : "🎉"\n' },
    { before: "", range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } }, text: "start\n", after: "start\n" },
  ];

  for (const { before, range, text, after } of editRoundTrips) {
    it(`applyEditsToDocument: ${JSON.stringify(before)} -> ${JSON.stringify(after)}`, () => {
      const doc = TextDocument.create(uri, "conceptbase", 1, before);
      const updated = applyEditsToDocument(doc, [{ range, text }]);
      expect(updated.getText()).to.equal(after);
    });
  }

  it("offsetAt/positionAt round-trip for every code unit", () => {
    const text = 'José "😀" end\n';
    const doc = TextDocument.create(uri, "conceptbase", 1, text);
    for (let i = 0; i <= text.length; i++) {
      const pos = doc.positionAt(i);
      expect(doc.offsetAt(pos)).to.equal(i);
    }
  });
});
