import { expect } from "chai";
import { TextDocument } from "vscode-languageserver-textdocument";
import {
  applyEditsToDocument,
  TextEditingFramework,
  validateUtf16Range,
} from "../../src/lsp/text/editing";
import { validateLinePosition } from "../../src/lsp/text/lines";
import { createCbsDocument } from "../helpers/edit-document";
import { freshEditor, openEditor } from "../helpers/text-editing-harness";

describe("UTF-16 range validation", () => {
  const uri = "file:///validate.cbs";

  const validCases: Array<{ name: string; text: string; range: { start: { line: number; character: number }; end: { line: number; character: number } } }> = [
    { name: "empty document zero-width at origin", text: "", range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } } },
    { name: "single char delete", text: "x", range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } } },
    { name: "insert at end of line", text: "ab", range: { start: { line: 0, character: 2 }, end: { line: 0, character: 2 } } },
    { name: "full line select", text: "hello\nworld\n", range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } } },
    { name: "cross-line through newline", text: "aa\nbb\n", range: { start: { line: 0, character: 1 }, end: { line: 1, character: 1 } } },
    { name: "end at line boundary", text: "aa\nbb\n", range: { start: { line: 0, character: 0 }, end: { line: 1, character: 0 } } },
    { name: "emoji line insert point", text: 'x "😀" y', range: { start: { line: 0, character: 3 }, end: { line: 0, character: 3 } } },
    { name: "jose accent mid-line", text: '"José"', range: { start: { line: 0, character: 2 }, end: { line: 0, character: 3 } } },
  ];

  for (const { name, text, range } of validCases) {
    it(`accepts valid range: ${name}`, () => {
      const doc = createCbsDocument(uri, text, 1);
      expect(validateUtf16Range(doc, range)).to.equal(undefined);
    });
  }

  const invalidCases: Array<{
    name: string;
    text: string;
    range: { start: { line: number; character: number }; end: { line: number; character: number } };
    pattern: RegExp;
  }> = [
    {
      name: "line past end",
      text: "a\n",
      range: { start: { line: 5, character: 0 }, end: { line: 5, character: 0 } },
      pattern: /out of range/,
    },
    {
      name: "negative line",
      text: "a",
      range: { start: { line: -1, character: 0 }, end: { line: 0, character: 0 } },
      pattern: /out of range/,
    },
    {
      name: "character past line end on start",
      text: "ab",
      range: { start: { line: 0, character: 3 }, end: { line: 0, character: 3 } },
      pattern: /past end of line/,
    },
    {
      name: "character past line end on end",
      text: "ab",
      range: { start: { line: 0, character: 0 }, end: { line: 0, character: 99 } },
      pattern: /past end of line/,
    },
    {
      name: "negative character",
      text: "ab",
      range: { start: { line: 0, character: -1 }, end: { line: 0, character: 0 } },
      pattern: /non-negative/,
    },
    {
      name: "reversed offset range",
      text: "abcd",
      range: { start: { line: 0, character: 3 }, end: { line: 0, character: 1 } },
      pattern: /out of bounds/,
    },
    {
      name: "end line out of range",
      text: "a\nb\n",
      range: { start: { line: 0, character: 0 }, end: { line: 9, character: 0 } },
      pattern: /out of range/,
    },
  ];

  for (const { name, text, range, pattern } of invalidCases) {
    it(`rejects invalid range: ${name}`, () => {
      const doc = createCbsDocument(uri, text, 1);
      expect(validateUtf16Range(doc, range)).to.match(pattern);
    });
  }

  it("validateLinePosition allows character at line length (exclusive end)", () => {
    const doc = createCbsDocument(uri, "abc", 1);
    expect(validateLinePosition(doc, { line: 0, character: 3 })).to.equal(undefined);
  });

  it("applyEditsToDocument throws on first invalid edit in batch", () => {
    const doc = createCbsDocument(uri, "hello", 1);
    expect(() =>
      applyEditsToDocument(doc, [
        { range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } }, text: "H" },
        { range: { start: { line: 0, character: 0 }, end: { line: 0, character: 999 } }, text: "X" },
      ])
    ).to.throw(/past end of line/);
  });

  it("framework rejects edit on unknown uri without throwing", () => {
    const { editor, uri: u } = freshEditor();
    const r = editor.applyEdits(u, [{ range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } }, text: "x" }], 2);
    expect(r.ok).to.equal(false);
    if (!r.ok) expect(r.reason).to.equal("unknown-uri");
  });

  it("insertAt on unknown uri returns unknown-uri", () => {
    const { editor, uri: u } = freshEditor();
    const r = editor.insertAt(u, 0, 0, "x");
    expect(r.ok).to.equal(false);
  });

  it("deleteRange on unknown uri returns unknown-uri", () => {
    const { editor, uri: u } = freshEditor();
    const r = editor.deleteRange(u, { line: 0, character: 0 }, { line: 0, character: 1 });
    expect(r.ok).to.equal(false);
  });

  it("getLine returns undefined for out-of-range line", () => {
    const { editor, uri: u } = openEditor("a\n", uri);
    expect(editor.getLine(u, -1)).to.equal(undefined);
    expect(editor.getLine(u, 99)).to.equal(undefined);
  });

  it("CRLF document validates and edits across line break", () => {
    const doc = createCbsDocument(uri, "a\r\nb\r\n", 1);
    expect(validateUtf16Range(doc, { start: { line: 0, character: 1 }, end: { line: 1, character: 0 } })).to.equal(undefined);
    const updated = applyEditsToDocument(doc, [
      { range: { start: { line: 0, character: 1 }, end: { line: 1, character: 0 } }, text: "Z" },
    ]);
    // Replaces CRLF between lines with Z (joins lines)
    expect(updated.getText()).to.equal("aZb\r\n");
  });
});
