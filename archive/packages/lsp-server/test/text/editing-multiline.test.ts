import { expect } from "chai";
import { TextEditingFramework } from "../../src/lsp/text/editing";
import { getLineText } from "../../src/lsp/text/encoding";
import { EMPLOYEE_FRAME, MSFOL_ASSERTION } from "../fixtures/corpus";
import { applySequence, assertAllLinesMatch, openEditor } from "../helpers/text-editing-harness";

describe("multiline text editing", () => {
  const uri = "file:///multiline.cbs";

  it("replaces entire document in one edit", () => {
    const { editor, uri: u } = openEditor("old\n", uri);
    editor.applyEdits(u, [{ range: { start: { line: 0, character: 0 }, end: { line: 1, character: 0 } }, text: "new\ncontent\n" }], 2);
    expect(editor.getDocument(u)!.getText()).to.equal("new\ncontent\n");
    expect(editor.getLineCount(u)).to.equal(3);
  });

  it("deletes multiple full lines", () => {
    const { editor, uri: u } = openEditor("keep\nremove1\nremove2\nkeep2\n", uri);
    editor.deleteRange(u, { line: 1, character: 0 }, { line: 3, character: 0 }, 2);
    expect(editor.getDocument(u)!.getText()).to.equal("keep\nkeep2\n");
  });

  it("inserts block at middle line boundary", () => {
    const { editor, uri: u } = openEditor("line0\nline1\nline2\n", uri);
    editor.insertAt(u, 1, 0, "midA\nmidB\n", 2);
    expect(editor.getLine(u, 1)).to.equal("midA");
    expect(editor.getLine(u, 2)).to.equal("midB");
    expect(editor.getLine(u, 3)).to.equal("line1");
  });

  it("single batch with multiple non-overlapping edits applies in order", () => {
    const { editor, uri: u } = openEditor("aaaa\nbbbb\ncccc\n", uri);
    // LSP applies edits in array order on successive buffer states within one update
    const r = editor.applyEdits(
      u,
      [
        { range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } }, text: "A" },
        { range: { start: { line: 2, character: 0 }, end: { line: 2, character: 1 } }, text: "C" },
      ],
      2
    );
    expect(r.ok).to.equal(true);
    const text = editor.getDocument(u)!.getText();
    expect(text.startsWith("Aaaa")).to.equal(true);
    expect(text).to.contain("Cccc");
  });

  it("append lines at EOF", () => {
    const { editor, uri: u } = openEditor("start\n", uri);
    const doc = editor.getDocument(u)!;
    const lastLine = doc.lineCount - 1;
    const lastLen = getLineText(doc, lastLine).length;
    editor.insertAt(u, lastLine, lastLen, "\nend\n", 2);
    expect(editor.getLine(u, lastLine + 1)).to.equal("end");
  });

  it("delete from middle of line through start of next line", () => {
    const { editor, uri: u } = openEditor("abcdef\nghijkl\n", uri);
    editor.deleteRange(u, { line: 0, character: 3 }, { line: 1, character: 2 }, 2);
    expect(editor.getDocument(u)!.getText()).to.equal("abcijkl\n");
  });

  it("collapse three lines into one", () => {
    const { editor, uri: u } = openEditor("one\ntwo\nthree\n", uri);
    editor.deleteRange(u, { line: 0, character: 3 }, { line: 2, character: 0 }, 2);
    expect(editor.getDocument(u)!.getText()).to.equal("onethree\n");
  });

  it("preserves indentation when inserting attribute block", () => {
    const { editor, uri: u } = openEditor(EMPLOYEE_FRAME, uri);
    editor.insertAt(u, 2, 4, "age : Integer\n    ", 2);
    const line = editor.getLine(u, 2)!;
    expect(line).to.match(/^\s{4}age : Integer$/);
    expect(editor.getLine(u, 3)).to.match(/^\s{4}name/);
  });

  it("edits MSFOL assertion without breaking line structure", () => {
    const { editor, uri: u } = openEditor(MSFOL_ASSERTION, uri);
    editor.insertAt(u, 0, 2, "/* q */ ", 2);
    expect(editor.getLine(u, 0)).to.contain("/* q */");
    expect(editor.getLineCount(u)).to.equal(2);
  });

  const lineEndingCases = [
    { name: "LF", text: "a\nb\nc\n" },
    { name: "CRLF", text: "a\r\nb\r\nc\r\n" },
    { name: "mixed after edit", text: "a\nb\r\nc\n" },
  ];

  for (const { name, text } of lineEndingCases) {
    it(`getLine reflects content after ${name} endings`, () => {
      const { editor, uri: u } = openEditor(text, uri);
      expect(editor.getLine(u, 0)).to.equal("a");
      expect(editor.getLine(u, 1)).to.equal("b");
      editor.insertAt(u, 1, 1, "X", 2);
      assertAllLinesMatch(editor.getDocument(u)!);
    });
  }

  it("ten sequential single-char inserts build expected string", () => {
    const { editor, uri: u } = openEditor("", uri);
    const chars = "0123456789";
    for (let i = 0; i < chars.length; i++) {
      const doc = editor.getDocument(u)!;
      const line = doc.lineCount - 1;
      const col = getLineText(doc, line).length;
      editor.insertAt(u, line, col, chars[i], doc.version + 1);
    }
    expect(editor.getDocument(u)!.getText()).to.equal(chars);
  });

  it("delete all content leaves empty document", () => {
    const { editor, uri: u } = openEditor("only\n", uri);
    const doc = editor.getDocument(u)!;
    editor.deleteRange(
      u,
      { line: 0, character: 0 },
      { line: doc.lineCount - 1, character: getLineText(doc, doc.lineCount - 1).length },
      2
    );
    expect(editor.getDocument(u)!.getText()).to.equal("");
    expect(editor.getLineCount(u)).to.equal(1);
  });

  it("large block insert increases line count predictably", () => {
    const { editor, uri: u } = openEditor("root\n", uri);
    const block = Array.from({ length: 50 }, (_, i) => `  line${i} : Integer`).join("\n") + "\n";
    editor.insertAt(u, 1, 0, block, 2);
    expect(editor.getLineCount(u)).to.equal(52);
  });
});
