import { expect } from "chai";
import { DocumentRegistry } from "../../src/lsp/document-registry";
import {
  applyEditsToDocument,
  TextEditingFramework,
  validateUtf16Range,
} from "../../src/lsp/text/editing";
import { getLineText } from "../../src/lsp/text/encoding";
import { EMPLOYEE_FRAME } from "../fixtures/corpus";
import { createCbsDocument } from "../helpers/edit-document";

describe("TextEditingFramework", () => {
  const uri = "file:///edit.cbs";

  it("opens, edits with UTF-16 ranges, and tracks lines", () => {
    const reg = new DocumentRegistry();
    const editor = new TextEditingFramework(reg);
    editor.open(createCbsDocument(uri, EMPLOYEE_FRAME, 1));

    expect(editor.getLine(uri, 0)).to.equal("Employee in EntityType with");
    const r = editor.insertAt(uri, 2, 4, "salary : Integer\n    ", 2);
    expect(r.ok).to.equal(true);
    expect(editor.getLine(uri, 2)).to.contain("salary");
    expect(reg.getAcceptedVersion(uri)).to.equal(2);
  });

  it("rejects invalid UTF-16 range (character past line end)", () => {
    const doc = createCbsDocument(uri, "ab", 1);
    const err = validateUtf16Range(doc, {
      start: { line: 0, character: 0 },
      end: { line: 0, character: 999 },
    });
    expect(err).to.match(/past end of line/);
  });

  it("throws on applyEdits with out-of-bounds range", () => {
    const reg = new DocumentRegistry();
    const editor = new TextEditingFramework(reg);
    editor.open(createCbsDocument(uri, "x", 1));
    expect(() =>
      editor.applyEdits(uri, [{ range: { start: { line: 0, character: 5 }, end: { line: 0, character: 6 } }, text: "y" }], 2)
    ).to.throw(/Invalid UTF-16/);
  });

  it("deleteRange removes UTF-16 slice", () => {
    const reg = new DocumentRegistry();
    const editor = new TextEditingFramework(reg);
    editor.open(createCbsDocument(uri, "hello", 1));
    editor.deleteRange(uri, { line: 0, character: 1 }, { line: 0, character: 4 }, 2);
    expect(editor.getDocument(uri)!.getText()).to.equal("ho");
  });

  it("applyEditsToDocument mirrors framework validation", () => {
    let doc = createCbsDocument(uri, "abc", 1);
    doc = applyEditsToDocument(doc, [{ range: { start: { line: 0, character: 1 }, end: { line: 0, character: 2 } }, text: "Z" }]);
    expect(doc.getText()).to.equal("aZc");
  });

  it("close clears registry entry", () => {
    const reg = new DocumentRegistry();
    const editor = new TextEditingFramework(reg);
    editor.open(createCbsDocument(uri, "x", 1));
    editor.close(uri);
    expect(editor.getDocument(uri)).to.equal(undefined);
  });

  it("getLineCount tracks buffer lines without parse", () => {
    const reg = new DocumentRegistry();
    const editor = new TextEditingFramework(reg);
    editor.open(createCbsDocument(uri, EMPLOYEE_FRAME, 1));
    expect(editor.getLineCount(uri)).to.equal(5);
    editor.insertAt(uri, 2, 4, "extra : String\n    ", 2);
    expect(editor.getLineCount(uri)).to.equal(6);
  });

  it("getLineText via editor matches TextDocument after multi-version edits", () => {
    const reg = new DocumentRegistry();
    const editor = new TextEditingFramework(reg);
    editor.open(createCbsDocument(uri, "line0\nline1\n", 1));
    editor.insertAt(uri, 1, 0, "prefix ", 2);
    const doc = editor.getDocument(uri)!;
    expect(editor.getLine(uri, 1)).to.equal(getLineText(doc, 1));
    expect(editor.getLine(uri, 1)).to.equal("prefix line1");
  });
});
