import type * as ihsm from "ihsm";
import { expect } from "chai";
import { CancellableRequestDeferred } from "../../src/lsp/cancellation/cancellable-request-deferred";
import { LspActorRegistry } from "../../src/lsp/registry/lsp-actor-registry";

function mockOwner(): ihsm.Hsm & { events: string[] } {
  const events: string[] = [];
  return {
    events,
    post(event: string) {
      events.push(event);
    },
  } as unknown as ihsm.Hsm & { events: string[] };
}

describe("CancellableRequestDeferred", () => {
  it("posts asyncStarted on construction", () => {
    const owner = mockOwner();
    const registry = new LspActorRegistry();
    new CancellableRequestDeferred(owner, "req-1", registry);
    expect(owner.events).to.deep.equal(["asyncStarted"]);
  });

  it("posts resolved when work succeeds", async () => {
    const owner = mockOwner();
    const registry = new LspActorRegistry();
    const deferred = new CancellableRequestDeferred(owner, "req-2", registry);
    await deferred.run(async () => "value");
    expect(owner.events).to.include("resolved");
  });

  it("posts cancelled when aborted before completion", async () => {
    const owner = mockOwner();
    const registry = new LspActorRegistry();
    const deferred = new CancellableRequestDeferred(owner, "req-3", registry);
    await deferred.run(async (signal) => {
      deferred.cancel();
      if (signal.aborted) throw new Error("aborted");
      return "never";
    });
    expect(owner.events).to.include("cancelled");
    expect(owner.events).to.not.include("resolved");
  });

  it("posts cancelled when registry marks request cancelled", async () => {
    const owner = mockOwner();
    const registry = new LspActorRegistry();
    const requestId = "req-4";
    const deferred = new CancellableRequestDeferred(owner, requestId, registry);
    await deferred.run(async () => {
      registry.cancel(requestId);
      return "late";
    });
    expect(owner.events).to.include("cancelled");
    expect(owner.events).to.not.include("resolved");
  });
});
