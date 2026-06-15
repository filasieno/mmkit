import { expect } from "chai";
import { DocumentRegistry } from "../../src/lsp/document-registry";
import { TextEditingFramework } from "../../src/lsp/text/editing";
import { getLineText } from "../../src/lsp/text/encoding";
import { createCbsDocument } from "../helpers/edit-document";
import {
  BROKEN_FRAME,
  EMPLOYEE_FRAME,
  MSFOL_ASSERTION,
  NOTEBOOK_CELL_A,
  SIMPLE_ECARULE,
  UNICODE_FRAME,
} from "../fixtures/corpus";
import { applySequence, openEditor } from "../helpers/text-editing-harness";

describe("ConceptBase editing scenarios", () => {
  const uri = "file:///cb.cbs";

  it("adds property to Employee frame", () => {
    const { editor, uri: u } = openEditor(EMPLOYEE_FRAME, uri);
    editor.insertAt(u, 2, 4, "salary : Integer\n    ", 2);
    expect(editor.getDocument(u)!.getText()).to.contain("salary : Integer");
    expect(editor.getLineCount(u)).to.equal(6);
  });

  it("renames frame head identifier", () => {
    const { editor, uri: u } = openEditor(EMPLOYEE_FRAME, uri);
    editor.deleteRange(u, { line: 0, character: 0 }, { line: 0, character: 8 }, 2);
    editor.insertAt(u, 0, 0, "Worker", 3);
    expect(editor.getLine(u, 0)).to.equal("Worker in EntityType with");
  });

  it("fixes broken frame by appending end", () => {
    const { editor, uri: u } = openEditor(BROKEN_FRAME, uri);
    const doc = editor.getDocument(u)!;
    const last = doc.lineCount - 1;
    const col = getLineText(doc, last).length;
    editor.insertAt(u, last, col, "\nend\n", 2);
    expect(editor.getDocument(u)!.getText()).to.contain("end\n");
    expect(editor.getDocument(u)!.getText()).to.match(/name : String[\s\S]*end/);
  });

  it("wraps MSFOL assertion in comment", () => {
    const { editor, uri: u } = openEditor(MSFOL_ASSERTION, uri);
    editor.insertAt(u, 0, 0, "// ", 2);
    const line0 = editor.getLine(u, 0)!;
    editor.insertAt(u, 0, line0.length, " // end", 3);
    expect(editor.getLine(u, 0)).to.match(/^\/\/ \$ forall/);
    expect(editor.getLine(u, 0)).to.contain("// end");
  });

  it("inserts IF guard into ECArule", () => {
    const { editor, uri: u } = openEditor(SIMPLE_ECARULE, uri);
    editor.insertAt(u, 2, 0, "  // threshold check\n", 2);
    expect(editor.getLine(u, 2)).to.contain("threshold");
    expect(editor.getDocument(u)!.getText()).to.contain("IF (n < 500)");
  });

  it("edits notebook-style QueryClass cell", () => {
    const { editor, uri: u } = openEditor(NOTEBOOK_CELL_A, uri);
    editor.insertAt(u, 1, 5, "  // constraint block\n     ", 2);
    expect(editor.getLine(u, 1)).to.contain("constraint block");
    expect(editor.getDocument(u)!.getText()).to.contain("all_bosse_srule");
  });

  it("unicode frame: add attribute after city", () => {
    const { editor, uri: u } = openEditor(UNICODE_FRAME, uri);
    applySequence(
      editor,
      u,
      [
        [{ range: { start: { line: 3, character: 4 }, end: { line: 3, character: 4 } }, text: "country : \"Brasil\"\n    " }],
      ],
      1
    );
    expect(editor.getDocument(u)!.getText()).to.contain("Brasil");
    expect(editor.getDocument(u)!.getText()).to.contain("São Paulo");
  });

  it("delete entire attribute block", () => {
    const { editor, uri: u } = openEditor(EMPLOYEE_FRAME, uri);
    editor.deleteRange(u, { line: 1, character: 0 }, { line: 3, character: 0 }, 2);
    const text = editor.getDocument(u)!.getText();
    expect(text).to.not.contain("attribute");
    expect(text).to.not.contain("name : String");
    expect(text).to.contain("end");
  });

  it("duplicate property line via copy insert", () => {
    const { editor, uri: u } = openEditor(EMPLOYEE_FRAME, uri);
    const propLine = editor.getLine(u, 2)!;
    editor.insertAt(u, 3, 0, propLine + "\n", 2);
    expect(editor.getLine(u, 3)).to.equal(propLine);
    expect(editor.getLine(u, 4)).to.equal("end");
  });

  const refactorSteps: Array<{ name: string; initial: string; edits: Array<{ line: number; char: number; text: string }>; expect: RegExp }> = [
    {
      name: "prefix comment on frame",
      initial: EMPLOYEE_FRAME,
      edits: [{ line: 0, char: 0, text: "// model\n" }],
      expect: /^\/\/ model/,
    },
    {
      name: "change String to Integer",
      initial: EMPLOYEE_FRAME,
      edits: [{ line: 2, char: 11, text: "Integer" }],
      expect: /name : Integer/,
    },
    {
      name: "add blank line before end",
      initial: EMPLOYEE_FRAME,
      edits: [{ line: 3, char: 0, text: "\n" }],
      expect: /\n\nend/,
    },
  ];

  for (const { name, initial, edits, expect: pattern } of refactorSteps) {
    it(`refactor: ${name}`, () => {
      const { editor, uri: u } = openEditor(initial, uri);
      let version = 1;
      for (const { line, char, text } of edits) {
        version++;
        if (text.length === 0) continue;
        if (text === "Integer") {
          editor.deleteRange(u, { line, character: char }, { line, character: char + 6 }, version);
          editor.insertAt(u, line, char, text, version + 1);
          version++;
        } else {
          editor.insertAt(u, line, char, text, version);
        }
      }
      expect(editor.getDocument(u)!.getText()).to.match(pattern);
    });
  }

  it("simulates typing an assertion character by character", () => {
    const { editor, uri: u } = openEditor("", uri);
    const target = "$ x $";
    let version = 1;
    for (const ch of target) {
      const doc = editor.getDocument(u)!;
      const line = doc.lineCount - 1;
      const col = getLineText(doc, line).length;
      version++;
      editor.insertAt(u, line, col, ch, version);
    }
    expect(editor.getDocument(u)!.getText()).to.equal(target);
  });

  it("multiple documents in one registry stay isolated", () => {
    const reg = new DocumentRegistry();
    const editor = new TextEditingFramework(reg);
    const a = "file:///a.cbs";
    const b = "file:///b.cbs";
    editor.open(createCbsDocument(a, "aaa\n", 1));
    editor.open(createCbsDocument(b, "bbb\n", 1));
    editor.insertAt(a, 0, 0, "A", 2);
    editor.insertAt(b, 0, 0, "B", 2);
    expect(editor.getDocument(a)!.getText()).to.equal("Aaaa\n");
    expect(editor.getDocument(b)!.getText()).to.equal("Bbbb\n");
  });
});
