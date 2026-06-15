import { expect } from "chai";
import { CancellationTokenSource } from "vscode-languageserver/node";
import { runSemanticTokensFullRequest } from "../../src/lsp/requests/semantic-tokens/full-request.hsm";
import { isTreeSitterAvailable } from "../../src/lsp/tree-sitter/runtime";
import { SIMPLE_ECARULE } from "../fixtures/corpus";
import { createCbsDocument } from "../helpers/edit-document";
import { mockLspServer } from "../helpers/mock-lsp-server";
import { SimLspActuators } from "../../src/lsp/ports/sim/sim-lsp-actuators";

describe("SemanticTokensFullRequest HSM", function () {
  before(async function () {
    if (!(await isTreeSitterAvailable())) this.skip();
  });

  const uri = "file:///semantic-full-hsm.cbs";

  it("completes with work-done progress and clears registry", async () => {
    const actuators = new SimLspActuators();
    const server = mockLspServer(actuators);
    const doc = createCbsDocument(uri, SIMPLE_ECARULE, 1);
    server.documentRegistry.trackOpen(doc);

    const tokens = await runSemanticTokensFullRequest(server, { textDocument: { uri } });
    expect(tokens.data.length).to.be.greaterThan(0);

    const requestIds = [...new Set(actuators.progress.map((p) => p.token))];
    expect(requestIds.length).to.be.greaterThan(0);
    const sequence = actuators.workDoneSequence(requestIds[0]!);
    expect(sequence[0]).to.deep.include({ kind: "begin", title: "Semantic tokens (full)" });
    expect(sequence.some((s) => s.kind === "report")).to.be.true;
    expect(sequence.some((s) => s.kind === "end")).to.be.true;
    expect(server.registry.size()).to.equal(0);
  });

  it("cancels via CancellationToken without completing", async () => {
    const server = mockLspServer();
    const doc = createCbsDocument(uri, SIMPLE_ECARULE, 1);
    server.documentRegistry.trackOpen(doc);

    const source = new CancellationTokenSource();
    const result = runSemanticTokensFullRequest(server, { textDocument: { uri } }, source.token);
    source.cancel();

    let caught: unknown;
    try {
      await result;
      expect.fail("expected cancellation");
    } catch (e) {
      caught = e;
    }
    expect(String(caught)).to.include("cancelled");
    expect(server.registry.size()).to.equal(0);
  });

});
