import { expect } from "chai";
import { DocumentRegistry } from "../src/lsp/document-registry";
import { createCbsDocument, insertAt } from "./helpers/edit-document";

describe("DocumentRegistry versioning", () => {
  const uri = "file:///version.cbs";

  it("tracks open and exposes ConceptBaseDocument", () => {
    const reg = new DocumentRegistry();
    const doc = createCbsDocument(uri, "frame\n", 1);
    const open = reg.trackOpen(doc);
    expect(open.ok).to.equal(true);
    const cbd = reg.getConceptBaseDocument(uri);
    expect(cbd?.version).to.equal(1);
    expect(cbd?.tree).to.equal(undefined);
  });

  it("applies incremental changes with strict version +1", () => {
    const reg = new DocumentRegistry();
    reg.trackOpen(createCbsDocument(uri, "ab", 1));
    const r2 = reg.trackChange(uri, [{ range: { start: { line: 0, character: 1 }, end: { line: 0, character: 1 } }, text: "X" }], 2);
    expect(r2.ok).to.equal(true);
    if (r2.ok) expect(r2.document.getText()).to.equal("aXb");
    expect(reg.getAcceptedVersion(uri)).to.equal(2);
  });

  it("rejects stale version", () => {
    const reg = new DocumentRegistry();
    reg.trackOpen(createCbsDocument(uri, "x", 2));
    const stale = reg.trackChange(uri, [{ range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } }, text: "" }], 2);
    expect(stale.ok).to.equal(false);
    if (!stale.ok) expect(stale.reason).to.equal("stale-version");
  });

  it("rejects version gap", () => {
    const reg = new DocumentRegistry();
    reg.trackOpen(createCbsDocument(uri, "x", 1));
    const gap = reg.trackChange(uri, [{ range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } }, text: "" }], 5);
    expect(gap.ok).to.equal(false);
    if (!gap.ok) expect(gap.reason).to.equal("version-gap");
  });

  it("stores tree sidecar separately from buffer", () => {
    const reg = new DocumentRegistry();
    reg.trackOpen(createCbsDocument(uri, "()", 1));
    const fakeTree = {
      rootNode: {
        type: "source_file",
        startIndex: 0,
        endIndex: 2,
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 0, column: 2 },
        childCount: 0,
        hasError: false,
        isMissing: false,
        child: () => null,
      },
    };
    reg.setTree(uri, fakeTree);
    const cbd = reg.getConceptBaseDocument(uri)!;
    expect(cbd.document.getText()).to.equal("()");
    expect(cbd.tree).to.equal(fakeTree);
    reg.trackClose(uri);
    expect(reg.getConceptBaseDocument(uri)).to.equal(undefined);
  });

  it("trackSyncedDocument matches TextDocuments event flow", () => {
    const reg = new DocumentRegistry();
    let doc = createCbsDocument(uri, "a", 1);
    reg.trackOpen(doc);
    doc = insertAt(doc, 0, 1, "b");
    const sync = reg.trackSyncedDocument(doc);
    expect(sync.ok).to.equal(true);
    expect(reg.getBuffer(uri)?.getText()).to.equal("ab");
  });
});
