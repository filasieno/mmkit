import { expect } from "chai";
import { TextDocumentSyncKind } from "vscode-languageserver/node";
import { TEXT_DOCUMENT_SYNC_INCREMENTAL, NOTEBOOK_TYPE, LANGUAGE_ID } from "@mmkit/shared";
import { buildServerCapabilities } from "../src/lsp/capabilities";
import { DocumentRegistry } from "../src/lsp/document-registry";
import { validateConceptBaseDocument } from "../src/lsp/parse";
import { createCbsDocument, insertAt } from "./helpers/edit-document";

describe("lsp-server incremental contract", () => {
  it("registers full TextDocumentSyncOptions with incremental change only", () => {
    const caps = buildServerCapabilities();
    const sync = caps.textDocumentSync;
    expect(sync).to.be.an("object");
    if (typeof sync !== "object") return;
    expect(sync.openClose).to.equal(true);
    expect(sync.change).to.equal(TextDocumentSyncKind.Incremental);
    expect(sync.change).to.equal(TEXT_DOCUMENT_SYNC_INCREMENTAL);
    expect(sync.change).to.not.equal(TextDocumentSyncKind.Full);
    expect(sync.willSave).to.equal(true);
    expect(sync.willSaveWaitUntil).to.equal(true);
    expect(sync.save).to.deep.equal({ includeText: true });
  });

  it("advertises notebook sync with save forwarding", () => {
    const caps = buildServerCapabilities();
    const nb = caps.notebookDocumentSync;
    expect(nb).to.be.an("object");
    if (!nb || Array.isArray(nb)) return;
    expect(nb.save).to.equal(true);
    expect(nb.notebookSelector).to.deep.equal([
      { notebook: NOTEBOOK_TYPE, cells: [{ language: LANGUAGE_ID }] },
    ]);
  });

  it("advertises semantic tokens full and range", () => {
    const caps = buildServerCapabilities();
    expect(caps.semanticTokensProvider?.full).to.equal(true);
    expect(caps.semanticTokensProvider?.range).to.equal(true);
    expect(caps.semanticTokensProvider?.legend.tokenTypes.length).to.be.greaterThan(0);
  });

  it("advertises workDoneProgress on semantic tokens provider", () => {
    const provider = buildServerCapabilities().semanticTokensProvider;
    expect(provider).to.be.an("object");
    if (!provider || typeof provider === "boolean") return;
    expect(provider.workDoneProgress).to.equal(true);
  });

  it("applies incremental contentChanges via DocumentRegistry", async () => {
    const uri = "file:///test.cbs";
    const reg = new DocumentRegistry();
    reg.trackOpen(createCbsDocument(uri, "frame\n  in\n", 1));
    const updated = insertAt(reg.getBuffer(uri)!, 1, 5, "name");
    reg.trackSyncedDocument(updated);
    expect(reg.getBuffer(uri)!.getText()).to.equal("frame\n  inname\n");
    const diagnostics = await validateConceptBaseDocument(reg, updated);
    expect(diagnostics).to.be.an("array");
  });

  it("reports bracket diagnostics for broken input when tree-sitter absent or after parse", async () => {
    const uri = "file:///bad.cbs";
    const reg = new DocumentRegistry();
    const doc = createCbsDocument(uri, "frame ( in [ end", 1);
    reg.trackOpen(doc);
    const diagnostics = await validateConceptBaseDocument(reg, doc);
    expect(diagnostics.length).to.be.greaterThan(0);
    expect(diagnostics[0].source).to.equal("conceptbase");
  });
});
