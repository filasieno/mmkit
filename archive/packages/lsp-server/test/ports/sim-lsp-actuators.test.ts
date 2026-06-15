import { expect } from "chai";
import { MessageType } from "vscode-languageserver/node";
import { SimLspActuators } from "../../src/lsp/ports/sim/sim-lsp-actuators";

describe("SimLspActuators", () => {
  it("records work-done progress sequence", () => {
    const sim = new SimLspActuators();
    sim.beginWorkDone("tok-1", "Working", true);
    sim.reportWorkDone("tok-1", "Halfway", 50);
    sim.endWorkDone("tok-1");
    const sequence = sim.workDoneSequence("tok-1");
    expect(sequence).to.have.length(3);
    expect(sequence[0]).to.deep.include({ kind: "begin", title: "Working", cancellable: true });
    expect(sequence[1]).to.deep.include({ kind: "report", message: "Halfway", percentage: 50 });
    expect(sequence[2]).to.deep.include({ kind: "end" });
  });

  it("records window, workspace, client, telemetry, and language actuators", async () => {
    const sim = new SimLspActuators();
    sim.logMessage(MessageType.Info, "hello");
    await sim.showErrorMessage("err", { title: "Retry" });
    await sim.showWarningMessage("warn");
    await sim.showInformationMessage("info");
    await sim.showDocument({ uri: "file:///a.cbs", external: false });
    sim.consoleLog("log");
    sim.consoleInfo("info");
    sim.consoleWarn("warn");
    sim.consoleError("error");
    sim.consoleDebug("debug");
    await sim.applyWorkspaceEdit({ changes: {} });
    await sim.getConfiguration([{ section: "mmkit" }]);
    await sim.getWorkspaceFolders();
    await sim.registerCapabilities([{ id: "1", method: "textDocument/didSave" }]);
    await sim.unregisterCapabilities([{ id: "1", method: "textDocument/didSave" }]);
    sim.refreshSemanticTokens();
    sim.logTelemetryEvent({ event: "test" });
    sim.logTrace("trace", "verbose");

    expect(sim.logMessages).to.have.length(1);
    expect(sim.showMessages).to.have.length(3);
    expect(sim.showDocuments).to.have.length(1);
    expect(sim.consoleLogLines).to.deep.equal(["log"]);
    expect(sim.consoleInfoLines).to.deep.equal(["info"]);
    expect(sim.consoleWarnLines).to.deep.equal(["warn"]);
    expect(sim.consoleErrorLines).to.deep.equal(["error"]);
    expect(sim.consoleDebugLines).to.deep.equal(["debug"]);
    expect(sim.workspaceEdits).to.have.length(1);
    expect(sim.configurationRequests).to.have.length(1);
    expect(sim.workspaceFolderRequestCount).to.equal(1);
    expect(sim.capabilityRegistrations).to.have.length(1);
    expect(sim.capabilityUnregistrations).to.have.length(1);
    expect(sim.semanticTokenRefreshCount).to.equal(1);
    expect(sim.telemetryEvents).to.deep.equal([{ event: "test" }]);
    expect(sim.traceLogs).to.deep.equal([{ message: "trace", verbose: "verbose" }]);
  });

  it("throws when throwOn is configured", () => {
    const sim = new SimLspActuators();
    sim.throwOn.beginWorkDone = new Error("simulated actuator fault");
    expect(() => sim.beginWorkDone("t", "title")).to.throw("simulated actuator fault");
  });
});
