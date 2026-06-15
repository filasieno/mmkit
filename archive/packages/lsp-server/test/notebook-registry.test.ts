import { expect } from "chai";
import { NOTEBOOK_TYPE } from "@mmkit/shared";
import { NotebookRegistry } from "../src/lsp/notebook-registry";

describe("NotebookRegistry", () => {
  const nbUri = "file:///session.mmnb";
  const cellA = "vscode-notebook-cell:/session.mmnb#cell-1";
  const cellB = "vscode-notebook-cell:/session.mmnb#cell-2";

  it("binds notebook URI to cell URIs", () => {
    const reg = new NotebookRegistry();
    const open = reg.trackOpen(nbUri, 1, NOTEBOOK_TYPE, [cellA, cellB]);
    expect(open.ok).to.equal(true);
    const record = reg.get(nbUri)!;
    expect(record.cellUris).to.deep.equal([cellA, cellB]);
    expect(reg.findNotebookForCell(cellB)?.uri).to.equal(nbUri);
  });

  it("rejects stale notebook version", () => {
    const reg = new NotebookRegistry();
    reg.trackOpen(nbUri, 3, NOTEBOOK_TYPE, [cellA]);
    const stale = reg.trackChange(nbUri, 3);
    expect(stale.ok).to.equal(false);
  });

  it("updates cell list on structural change", () => {
    const reg = new NotebookRegistry();
    reg.trackOpen(nbUri, 1, NOTEBOOK_TYPE, [cellA]);
    const ch = reg.trackChange(nbUri, 2, [cellA, cellB]);
    expect(ch.ok).to.equal(true);
    if (ch.ok) expect(ch.record.cellUris).to.have.length(2);
  });

  it("clears cell index on close", () => {
    const reg = new NotebookRegistry();
    reg.trackOpen(nbUri, 1, NOTEBOOK_TYPE, [cellA]);
    reg.trackClose(nbUri);
    expect(reg.get(nbUri)).to.equal(undefined);
    expect(reg.findNotebookForCell(cellA)).to.equal(undefined);
  });
});
