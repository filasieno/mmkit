import { expect } from "chai";
import type { Diagnostic } from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { DiagnosticsPublisher } from "../../src/lsp/diagnostics/publisher";
import { DocumentRegistry } from "../../src/lsp/document-registry";
import { EMPLOYEE_FRAME } from "../fixtures/corpus";

describe("DiagnosticsPublisher (Problems panel wiring)", () => {
  it("publish sends diagnostics to LSP client", async () => {
    const sent: Array<{ uri: string; diagnostics: Diagnostic[] }> = [];
    const publisher = new DiagnosticsPublisher((params) => sent.push(params));
    const reg = new DocumentRegistry();
    const uri = "file:///panel.cbs";
    reg.trackOpen(TextDocument.create(uri, "conceptbase", 1, EMPLOYEE_FRAME));

    const diags = await publisher.publish(reg, uri);
    expect(sent).to.have.length(1);
    expect(sent[0].uri).to.equal(uri);
    expect(sent[0].diagnostics).to.equal(diags);
  });

  it("clear sends empty diagnostics (closes Problems entries)", () => {
    const sent: Array<{ uri: string; diagnostics: Diagnostic[] }> = [];
    const publisher = new DiagnosticsPublisher((params) => sent.push(params));
    const uri = "file:///gone.cbs";
    publisher.clear(uri);
    expect(sent[0]).to.deep.equal({ uri, diagnostics: [] });
  });

  it("fromConnection adapter delegates to sendDiagnostics", async () => {
    const calls: unknown[] = [];
    const connection = {
      sendDiagnostics: async (p: unknown) => {
        calls.push(p);
      },
    };
    const publisher = DiagnosticsPublisher.fromConnection(connection);
    const reg = new DocumentRegistry();
    const uri = "file:///conn.cbs";
    reg.trackOpen(TextDocument.create(uri, "conceptbase", 1, "frame ( in ["));
    await publisher.publish(reg, uri);
    expect(calls).to.have.length(1);
  });
});
