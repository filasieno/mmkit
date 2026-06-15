import { expect } from "chai";
import {
  defaultVirtualNodeDocument,
  parseVirtualNodeDocument,
  serializeVirtualNodeDocument,
  virtualNodeUriParts,
} from "../../src/node-editor/virtual-document-core";

describe("virtual node document", () => {
  it("builds mmkit-node URIs with .cbn extension", () => {
    const uri = virtualNodeUriParts("concept-browser");
    expect(uri.scheme).to.equal("mmkit-node");
    expect(uri.path).to.equal("/concept-browser.cbn");
  });

  it("round-trips document metadata", () => {
    const doc = defaultVirtualNodeDocument("demo");
    const raw = serializeVirtualNodeDocument(doc);
    const uri = virtualNodeUriParts("demo");
    const parsed = parseVirtualNodeDocument(uri, raw);
    expect(parsed).to.deep.equal(doc);
  });

  it("falls back when buffer content is not JSON", () => {
    const uri = virtualNodeUriParts("legacy");
    const parsed = parseVirtualNodeDocument(uri, "not json");
    expect(parsed.nodeId).to.equal("legacy");
    expect(parsed.title).to.equal("ConceptBase Browser");
  });
});
