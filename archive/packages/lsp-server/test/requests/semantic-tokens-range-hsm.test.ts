import { expect } from "chai";
import { runSemanticTokensRangeRequest } from "../../src/lsp/requests/semantic-tokens/range-request.hsm";
import { isTreeSitterAvailable } from "../../src/lsp/tree-sitter/runtime";
import { SIMPLE_ECARULE } from "../fixtures/corpus";
import { createCbsDocument } from "../helpers/edit-document";
import { mockLspServer } from "../helpers/mock-lsp-server";
import { SimLspActuators } from "../../src/lsp/ports/sim/sim-lsp-actuators";

describe("SemanticTokensRangeRequest HSM", function () {
  before(async function () {
    if (!(await isTreeSitterAvailable())) this.skip();
  });

  const uri = "file:///semantic-range-hsm.cbs";

  it("completes for a sub-range and clears registry", async () => {
    const actuators = new SimLspActuators();
    const server = mockLspServer(actuators);
    const doc = createCbsDocument(uri, SIMPLE_ECARULE, 1);
    server.documentRegistry.trackOpen(doc);

    const tokens = await runSemanticTokensRangeRequest(server, {
      textDocument: { uri },
      range: {
        start: { line: 0, character: 0 },
        end: { line: 2, character: 0 },
      },
    });
    expect(tokens.data).to.be.an("array");
    expect(server.registry.size()).to.equal(0);
    const sequence = actuators.workDoneSequence(
      actuators.progress.find((p) => p.value.kind === "begin")!.token
    );
    expect(sequence[0]).to.deep.include({ kind: "begin", title: "Semantic tokens (range)" });
  });
});
