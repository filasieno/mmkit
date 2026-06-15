import { expect } from "chai";
import { SimLspActuators } from "../../src/lsp/ports/sim/sim-lsp-actuators";
import { registerRequestExecutor } from "../../src/lsp/requests/_shared/request-executor.hsm";
import { mockLspServer } from "../helpers/mock-lsp-server";

describe("request executor HSM", () => {
  it("completes request with work-done progress", async () => {
    const server = mockLspServer();
    const requestId = server.registry.allocateId("test/request");
    const resultPromise = new Promise<string>((resolve, reject) => {
      server.registry.registerCompleter(requestId, { resolve, reject });
    });

    registerRequestExecutor(server, {
      method: "test/request",
      requestId,
      params: { value: 1 },
      progressTitle: "Test work",
      work: async () => "done",
    });

    const result = await resultPromise;
    expect(result).to.equal("done");
    const sequence = (server.actuators as SimLspActuators).workDoneSequence(requestId);
    expect(sequence[0]).to.deep.include({ kind: "begin", title: "Test work" });
    expect(sequence.some((s) => s.kind === "end")).to.be.true;
    expect(server.registry.size()).to.equal(0);
  });

  it("cancels in-flight request without completing", async () => {
    const server = mockLspServer();
    const requestId = server.registry.allocateId("test/slow");
    const resultPromise = new Promise<string>((resolve, reject) => {
      server.registry.registerCompleter(requestId, { resolve, reject });
    });

    registerRequestExecutor(server, {
      method: "test/slow",
      requestId,
      params: {},
      progressTitle: "Slow",
      work: async (signal) => {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, 500);
          signal.addEventListener("abort", () => {
            clearTimeout(timer);
            reject(new Error("aborted"));
          });
        });
        return "never";
      },
    });

    await new Promise((r) => setTimeout(r, 50));
    server.registry.cancel(requestId);
    let caught: unknown;
    try {
      await resultPromise;
      expect.fail("expected cancellation");
    } catch (e) {
      caught = e;
    }
    expect(String(caught)).to.include("cancelled");
    expect(server.registry.size()).to.equal(0);
  });
});
