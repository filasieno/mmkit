import { expect } from "chai";
import * as ihsm from "ihsm";
import { CancelledLspRequestError } from "../../src/lsp/cancellation/cancellable-request-deferred";
import { createLspHsm } from "../../src/lsp/lsp-hsm-factory";
import { castLspActor } from "../../src/lsp/registry/lsp-actor-cast";
import type { LeakTestCtx } from "../../src/lsp/registry/lsp-actor-context-map";
import { LSP_ACTOR_TYPE_IDS } from "../../src/lsp/registry/lsp-actor-type-ids";
import { LspActorRegistry } from "../../src/lsp/registry/lsp-actor-registry";

interface CancelTestProtocol {
  cancel(): void;
}

class CancelTestTop extends ihsm.TopState<LeakTestCtx, CancelTestProtocol> {
  cancel(): void {
    // handled by test
  }
}

ihsm.InitialState(CancelTestTop);

describe("LspActorRegistry", () => {
  it("tracks cancellation and completers", () => {
    const registry = new LspActorRegistry();
    const requestId = registry.allocateId("test/method");
    let resolved: unknown;
    registry.registerCompleter(requestId, {
      resolve: (v) => {
        resolved = v;
      },
      reject: () => undefined,
    });

    registry.completeRequest(requestId, { ok: true });
    expect(resolved).to.deep.equal({ ok: true });
    expect(registry.isCancelled(requestId)).to.be.false;
  });

  it("failRequest rejects completer", async () => {
    const registry = new LspActorRegistry();
    const requestId = registry.allocateId("test/method");
    const err = new CancelledLspRequestError(requestId);
    const rejected = new Promise((_, reject) => {
      registry.registerCompleter(requestId, { resolve: () => undefined, reject });
    });
    registry.failRequest(requestId, err);
    let caught: unknown;
    try {
      await rejected;
      expect.fail("expected rejection");
    } catch (e) {
      caught = e;
    }
    expect(caught).to.be.instanceOf(CancelledLspRequestError);
  });

  it("cancel marks id and posts cancel event to registered actor", async () => {
    const registry = new LspActorRegistry();
    const requestId = registry.allocateId("test/cancel");
    const events: string[] = [];
    const ctx: LeakTestCtx = {
      typeId: LSP_ACTOR_TYPE_IDS.testLeak,
      actorId: "actor-1",
    };
    const hsm = createLspHsm(CancelTestTop, ctx);
    const originalPost = hsm.post.bind(hsm) as (event: string) => void;
    (hsm as { post: (event: string) => void }).post = (event: string) => {
      events.push(event);
      originalPost(event);
    };
    registry.register("actor-1", LSP_ACTOR_TYPE_IDS.testLeak, hsm, requestId);
    registry.cancel(requestId);
    expect(registry.isCancelled(requestId)).to.be.true;
    await new Promise((r) => setTimeout(r, 10));
    expect(events).to.include("cancel");
  });

  it("cast returns typed entry only when typeId matches", () => {
    const registry = new LspActorRegistry();
    const ctx: LeakTestCtx = {
      typeId: LSP_ACTOR_TYPE_IDS.testLeak,
      actorId: "actor-typed",
    };
    const hsm = createLspHsm(CancelTestTop, ctx);
    registry.register("actor-typed", LSP_ACTOR_TYPE_IDS.testLeak, hsm);

    const match = castLspActor(registry, "actor-typed", LSP_ACTOR_TYPE_IDS.testLeak);
    expect(match?.typeId).to.equal(LSP_ACTOR_TYPE_IDS.testLeak);
    expect(match?.hsm.ctx.typeId).to.equal(LSP_ACTOR_TYPE_IDS.testLeak);

    expect(castLspActor(registry, "actor-typed", LSP_ACTOR_TYPE_IDS.initialize)).to.be.undefined;
    expect(castLspActor(registry, "missing", LSP_ACTOR_TYPE_IDS.testLeak)).to.be.undefined;
  });
});
