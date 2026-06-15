import { expect } from "chai";
import { TextDocument } from "vscode-languageserver-textdocument";
import { TextDocumentSaveReason } from "vscode-languageserver/node";
import { spawnDidSaveNotification } from "../../src/lsp/requests/text-document/did-save-notification.hsm";
import { spawnWillSaveNotification } from "../../src/lsp/requests/text-document/will-save-notification.hsm";
import { runWillSaveWaitUntilRequest } from "../../src/lsp/requests/text-document/will-save-wait-until-request.hsm";
import { SimLspActuators } from "../../src/lsp/ports/sim/sim-lsp-actuators";
import { mockLspServer } from "../helpers/mock-lsp-server";

describe("text-document sync HSMs", () => {
  const uri = "file:///sync.cbs";
  const document = TextDocument.create(uri, "conceptbase", 1, "frame\n  in\n  end");

  it("willSave logs via actuators", async () => {
    const actuators = new SimLspActuators();
    const server = mockLspServer(actuators);
    spawnWillSaveNotification(server, { document, reason: TextDocumentSaveReason.Manual });
    await new Promise((r) => setTimeout(r, 30));
    expect(actuators.logMessages.some((m) => m.message.includes("will save"))).to.equal(true);
    expect(server.registry.size()).to.equal(0);
  });

  it("willSaveWaitUntil returns no edits", async () => {
    const server = mockLspServer();
    const edits = await runWillSaveWaitUntilRequest(server, {
      document,
      reason: TextDocumentSaveReason.AfterDelay,
    });
    expect(edits).to.deep.equal([]);
    expect(server.registry.size()).to.equal(0);
  });

  it("didSave logs and clears registry", async () => {
    const actuators = new SimLspActuators();
    const server = mockLspServer(actuators);
    server.documentRegistry.trackOpen(document);
    spawnDidSaveNotification(server, { document });
    await new Promise((r) => setTimeout(r, 30));
    expect(actuators.logMessages.some((m) => m.message.includes("saved"))).to.equal(true);
    expect(server.registry.size()).to.equal(0);
  });
});
