import { expect } from "chai";
import { LANGUAGE_ID, NOTEBOOK_TYPE } from "@mmkit/shared";
import { buildDocumentSelector, normalizeLspTraceSetting } from "../src/lsp/client-config";
import {
  LSP_TRACE_MESSAGES,
  LSP_TRACE_OFF,
  LSP_TRACE_VERBOSE,
  resolveLspTraceLevel,
} from "../src/lsp/trace-bridge";

describe("ConceptBase LSP client config", () => {
  it("selects .cbs files and notebook cells", () => {
    const selector = buildDocumentSelector();
    expect(selector).to.deep.include({ language: LANGUAGE_ID, scheme: "file" });
    expect(selector).to.deep.include({ language: LANGUAGE_ID, scheme: "vscode-notebook-cell" });
    expect(selector).to.deep.include({ notebook: NOTEBOOK_TYPE, language: LANGUAGE_ID });
  });

  it("normalizeLspTraceSetting maps settings to trace levels", () => {
    expect(normalizeLspTraceSetting("off")).to.equal("off");
    expect(normalizeLspTraceSetting("messages")).to.equal("messages");
    expect(normalizeLspTraceSetting("verbose")).to.equal("verbose");
    expect(normalizeLspTraceSetting("unknown")).to.equal("off");
  });

  it("resolveLspTraceLevel maps to LanguageClient Trace enum values", () => {
    expect(resolveLspTraceLevel("off")).to.equal(LSP_TRACE_OFF);
    expect(resolveLspTraceLevel("messages")).to.equal(LSP_TRACE_MESSAGES);
    expect(resolveLspTraceLevel("verbose")).to.equal(LSP_TRACE_VERBOSE);
  });
});
