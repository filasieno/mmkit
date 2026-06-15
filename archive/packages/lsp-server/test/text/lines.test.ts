import { expect } from "chai";
import { TextDocument } from "vscode-languageserver-textdocument";
import { DocumentRegistry } from "../../src/lsp/document-registry";
import { TextEditingFramework } from "../../src/lsp/text/editing";
import { getLineCount, getLineLength, validateLinePosition } from "../../src/lsp/text/lines";
import * as runtime from "../../src/lsp/tree-sitter/runtime";
import { EMPLOYEE_FRAME } from "../fixtures/corpus";
import { createCbsDocument } from "../helpers/edit-document";

describe("buffer-only line model (no tree-sitter reparse)", () => {
  const uri = "file:///lines.cbs";

  it("getLineCount uses TextDocument.lineCount directly", () => {
    const doc = TextDocument.create(uri, "conceptbase", 1, "a\nb\nc\n");
    expect(getLineCount(doc)).to.equal(4);
    expect(doc.lineCount).to.equal(4);
  });

  it("line count updates incrementally after TextDocument.update", () => {
    let doc = TextDocument.create(uri, "conceptbase", 1, "one\n");
    expect(getLineCount(doc)).to.equal(2);
    doc = TextDocument.update(
      doc,
      [{ range: { start: { line: 1, character: 0 }, end: { line: 1, character: 0 } }, text: "two\nthree\n" }],
      2
    );
    expect(getLineCount(doc)).to.equal(4);
  });

  it("validateLinePosition rejects character past line end", () => {
    const doc = TextDocument.create(uri, "conceptbase", 1, "ab");
    expect(validateLinePosition(doc, { line: 0, character: 999 })).to.match(/past end of line/);
  });

  it("getLineLength matches UTF-16 content width including emoji", () => {
    const doc = TextDocument.create(uri, "conceptbase", 1, 'tag : "😀"');
    expect(getLineLength(doc, 0)).to.equal(10);
  });

  it("TextEditingFramework line access does not call parseConceptBase", async () => {
    if (!(await runtime.isTreeSitterAvailable())) return;

    let parseCalls = 0;
    const original = runtime.parseConceptBase;
    const stub = (text: string, prev?: runtime.ParseTree) => {
      parseCalls++;
      return original(text, prev);
    };
    (runtime as { parseConceptBase: typeof original }).parseConceptBase = stub;

    try {
      const reg = new DocumentRegistry();
      const editor = new TextEditingFramework(reg);
      editor.open(createCbsDocument(uri, EMPLOYEE_FRAME, 1));

      parseCalls = 0;
      expect(editor.getLineCount(uri)).to.equal(5);
      expect(editor.getLine(uri, 0)).to.equal("Employee in EntityType with");
      editor.insertAt(uri, 2, 4, "salary : Integer\n    ", 2);
      expect(editor.getLineCount(uri)).to.equal(6);
      expect(editor.getLine(uri, 2)).to.contain("salary");
      expect(parseCalls).to.equal(0);
    } finally {
      (runtime as { parseConceptBase: typeof original }).parseConceptBase = original;
    }
  });
});
