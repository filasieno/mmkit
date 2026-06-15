import { expect } from "chai";
import type { TextDocument } from "vscode-languageserver-textdocument";
import { DocumentRegistry } from "../../src/lsp/document-registry";
import { TextEditingFramework, type LspTextEdit } from "../../src/lsp/text/editing";
import { getLineText } from "../../src/lsp/text/encoding";
import { createCbsDocument } from "./edit-document";

export function freshEditor(uri = "file:///harness.cbs"): {
  reg: DocumentRegistry;
  editor: TextEditingFramework;
  uri: string;
} {
  const reg = new DocumentRegistry();
  return { reg, editor: new TextEditingFramework(reg), uri };
}

export function openEditor(
  text: string,
  uri = "file:///harness.cbs",
  version = 1
): {
  reg: DocumentRegistry;
  editor: TextEditingFramework;
  uri: string;
} {
  const { reg, editor, uri: u } = freshEditor(uri);
  editor.open(createCbsDocument(u, text, version));
  return { reg, editor, uri: u };
}

/** Apply edits via framework, bumping version sequentially from `startVersion`. */
export function applySequence(
  editor: TextEditingFramework,
  uri: string,
  batches: LspTextEdit[][],
  startVersion = 1
): TextDocument {
  let version = startVersion;
  for (const batch of batches) {
    version++;
    const r = editor.applyEdits(uri, batch, version);
    expect(r.ok, JSON.stringify(r)).to.equal(true);
  }
  return editor.getDocument(uri)!;
}

/** Every line from buffer matches getLineText on the document. */
export function assertAllLinesMatch(doc: TextDocument): void {
  for (let line = 0; line < doc.lineCount; line++) {
    expect(getLineText(doc, line)).to.equal(
      doc.getText().slice(
        doc.offsetAt({ line, character: 0 }),
        line + 1 < doc.lineCount
          ? doc.offsetAt({ line: line + 1, character: 0 })
          : doc.getText().length
      ).replace(/\r?\n$/, "")
    );
  }
}
