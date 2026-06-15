import { expect } from "chai";
import { DocumentRegistry } from "../../src/lsp/document-registry";
import { TextEditingFramework } from "../../src/lsp/text/editing";
import { createCbsDocument } from "../helpers/edit-document";
import { freshEditor, openEditor } from "../helpers/text-editing-harness";

describe("TextEditingFramework versioning", () => {
  const uri = "file:///version.cbs";

  it("open records initial version", () => {
    const { reg, editor, uri: u } = openEditor("x\n", uri, 1);
    expect(reg.getAcceptedVersion(u)).to.equal(1);
    expect(editor.getDocument(u)!.version).to.equal(1);
  });

  it("insertAt auto-increments version when omitted", () => {
    const { reg, editor, uri: u } = openEditor("a\n", uri, 1);
    editor.insertAt(u, 0, 1, "b");
    expect(reg.getAcceptedVersion(u)).to.equal(2);
    editor.insertAt(u, 0, 2, "c");
    expect(reg.getAcceptedVersion(u)).to.equal(3);
    expect(editor.getDocument(u)!.getText()).to.equal("abc\n");
  });

  it("rejects stale version on applyEdits", () => {
    const { editor, uri: u } = openEditor("a\n", uri, 5);
    const r = editor.applyEdits(u, [{ range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } }, text: "X" }], 5);
    expect(r.ok).to.equal(false);
    if (!r.ok) expect(r.reason).to.equal("stale-version");
  });

  it("rejects version gap", () => {
    const { editor, uri: u } = openEditor("a\n", uri, 1);
    const r = editor.applyEdits(u, [{ range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } }, text: "X" }], 5);
    expect(r.ok).to.equal(false);
    if (!r.ok) expect(r.reason).to.equal("version-gap");
  });

  it("accepts strict +1 version chain", () => {
    const { reg, editor, uri: u } = openEditor("v\n", uri, 10);
    for (let v = 11; v <= 20; v++) {
      const r = editor.insertAt(u, 0, 0, String(v % 10), v);
      expect(r.ok).to.equal(true);
      expect(reg.getAcceptedVersion(u)).to.equal(v);
    }
  });

  it("buffer unchanged when version rejected", () => {
    const { editor, uri: u } = openEditor("stable\n", uri, 1);
    const before = editor.getDocument(u)!.getText();
    editor.applyEdits(u, [{ range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } }, text: "X" }], 1);
    expect(editor.getDocument(u)!.getText()).to.equal(before);
  });

  it("close then open resets version tracking", () => {
    const reg = new DocumentRegistry();
    const editor = new TextEditingFramework(reg);
    editor.open(createCbsDocument(uri, "first\n", 1));
    editor.insertAt(uri, 0, 0, "!", 2);
    editor.close(uri);
    editor.open(createCbsDocument(uri, "second\n", 1));
    expect(reg.getAcceptedVersion(uri)).to.equal(1);
    expect(editor.getDocument(uri)!.getText()).to.equal("second\n");
  });

  it("re-open with higher version replaces buffer", () => {
    const reg = new DocumentRegistry();
    const editor = new TextEditingFramework(reg);
    editor.open(createCbsDocument(uri, "old\n", 1));
    const r = editor.open(createCbsDocument(uri, "new\n", 3));
    expect(r.ok).to.equal(true);
    expect(editor.getDocument(uri)!.getText()).to.equal("new\n");
    expect(reg.getAcceptedVersion(uri)).to.equal(3);
  });

  it("getRegistry exposes same DocumentRegistry instance", () => {
    const { reg, editor } = freshEditor();
    expect(editor.getRegistry()).to.equal(reg);
  });
});
