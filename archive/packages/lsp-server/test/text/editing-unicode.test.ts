import { expect } from "chai";
import { TextEditingFramework, applyEditsToDocument } from "../../src/lsp/text/editing";
import { getLineText, lineSlice, utf16Length } from "../../src/lsp/text/encoding";
import { getLineLength } from "../../src/lsp/text/lines";
import { lspPositionToIndex } from "../../src/lsp/text/range-bridge";
import { UNICODE_FRAME } from "../fixtures/corpus";
import { createCbsDocument } from "../helpers/edit-document";
import { applySequence, assertAllLinesMatch, openEditor } from "../helpers/text-editing-harness";

describe("text editing with Unicode (UTF-16)", () => {
  const uri = "file:///unicode-edit.cbs";

  it("inserts before supplementary-plane emoji without splitting surrogate pair", () => {
    const { editor, uri: u } = openEditor('label : "😀"\n', uri);
    editor.insertAt(u, 0, 8, "note : ", 2);
    const text = editor.getDocument(u)!.getText();
    expect(text).to.equal('label : note : "😀"\n');
    expect(text.includes("\uD83D")).to.equal(true);
    expect([...text.matchAll(/😀/g)].length).to.equal(1);
  });

  it("deletes emoji as two UTF-16 code units in one operation", () => {
    const { editor, uri: u } = openEditor('x "😀" y\n', uri);
    // emoji occupies indices 3-4 (0-based): x␠"😀"␠y
    editor.deleteRange(u, { line: 0, character: 3 }, { line: 0, character: 5 }, 2);
    expect(editor.getDocument(u)!.getText()).to.equal('x "" y\n');
  });

  it("replaces accented name inside unicode frame", () => {
    const { editor, uri: u } = openEditor(UNICODE_FRAME, uri);
    const doc = editor.getDocument(u)!;
    const line2 = getLineText(doc, 2);
    const joseIdx = line2.indexOf("José");
    expect(joseIdx).to.be.greaterThan(-1);
    editor.deleteRange(
      u,
      { line: 2, character: joseIdx },
      { line: 2, character: joseIdx + utf16Length("José") },
      2
    );
    editor.insertAt(u, 2, joseIdx, "João", 3);
    expect(editor.getLine(u, 2)).to.contain("João");
    expect(editor.getLine(u, 2)).to.not.contain("José");
  });

  it("lineSlice across José preserves combining characters", () => {
    const doc = createCbsDocument(uri, 'name : "José";\n', 1);
    const slice = lineSlice(doc, 0, 7, 0, 13);
    expect(slice).to.equal('"José"');
    expect(utf16Length(slice)).to.equal(6);
  });

  it("getLineLength counts emoji width as 2 UTF-16 units each", () => {
    const doc = createCbsDocument(uri, 'tag : "😀🎉"\n', 1);
    expect(getLineLength(doc, 0)).to.equal(12);
  });

  it("insert multibyte text at end of São Paulo line", () => {
    const { editor, uri: u } = openEditor(UNICODE_FRAME, uri);
    const doc = editor.getDocument(u)!;
    const cityLine = 3;
    const len = getLineLength(doc, cityLine);
    editor.insertAt(u, cityLine, len, " /* BR */", 2);
    expect(editor.getLine(u, cityLine)).to.match(/São Paulo.*BR/);
  });

  const emojiInsertCases = [
    { at: 0, char: 0, insert: "😀", expect: '😀label : "x"\n' },
    { at: 0, char: 6, insert: "😀", expect: 'label 😀: "x"\n' },
    { at: 0, char: 11, insert: "!", expect: 'label : "x"!\n' },
  ];

  for (const { at, char, insert, expect: expected } of emojiInsertCases) {
    it(`emoji insert at line ${at} char ${char}`, () => {
      const { editor, uri: u } = openEditor('label : "x"\n', uri);
      editor.insertAt(u, at, char, insert, 2);
      expect(editor.getDocument(u)!.getText()).to.equal(expected);
    });
  }

  it("sequential edits preserve UTF-16 index round-trip", () => {
    const { editor, uri: u } = openEditor(UNICODE_FRAME, uri);
    applySequence(
      editor,
      u,
      [
        [{ range: { start: { line: 2, character: 4 }, end: { line: 2, character: 4 } }, text: "nick : String;\n    " }],
        [{ range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } }, text: "// header\n" }],
      ],
      1
    );
    const doc = editor.getDocument(u)!;
    assertAllLinesMatch(doc);
    const nickPos = doc.getText().indexOf("nick");
    expect(nickPos).to.be.greaterThan(-1);
    expect(doc.positionAt(nickPos).line).to.be.greaterThan(2);
  });

  it("deleteRange spanning newline with unicode on both sides", () => {
    const text = 'a : "José"\nb : "São"\n';
    const { editor, uri: u } = openEditor(text, uri);
    editor.deleteRange(u, { line: 0, character: 6 }, { line: 0, character: 9 }, 2);
    expect(editor.getLine(u, 0)).to.equal('a : "J"');
    editor.deleteRange(u, { line: 1, character: 0 }, { line: 2, character: 0 }, 3);
    expect(editor.getDocument(u)!.getText()).to.equal('a : "J"\n');
  });

  it("applyEditsToDocument handles ZWJ family emoji as two units each", () => {
    const family = "👨‍👩‍👧";
    const doc = createCbsDocument(uri, `x ${family} y`, 1);
    const start = lspPositionToIndex(doc, { line: 0, character: 2 });
    const end = start + family.length;
    const updated = applyEditsToDocument(doc, [
      {
        range: {
          start: doc.positionAt(start),
          end: doc.positionAt(end),
        },
        text: "👪",
      },
    ]);
    expect(updated.getText()).to.equal("x 👪 y");
    expect(utf16Length("👪")).to.equal(2);
  });
});
