import * as ihsm from "ihsm";
import { expect } from "chai";
import { createLspHsm } from "../../src/lsp/lsp-hsm-factory";
import { lspActorId } from "../../src/lsp/registry/lsp-actor-ids";
import type { LeakTestCtx } from "../../src/lsp/registry/lsp-actor-context-map";
import { LSP_ACTOR_TYPE_IDS } from "../../src/lsp/registry/lsp-actor-type-ids";
import { LspActorRegistry } from "../../src/lsp/registry/lsp-actor-registry";
import { spawnDidOpenNotification } from "../../src/lsp/requests/text-document/did-open-notification.hsm";
import { mockLspServer } from "../helpers/mock-lsp-server";
import { createCbsDocument } from "../helpers/edit-document";

interface LeakTestProtocol {
  start(): void;
}

class LeakTestTop extends ihsm.TopState<LeakTestCtx, LeakTestProtocol> {}

class LeakTestRunning extends LeakTestTop {
  onEntry(): void {
    this.transition(LeakTestDone);
  }
}

class LeakTestDone extends LeakTestTop {
  onEntry(): void {
    this.ctx.actorId;
  }
}

ihsm.InitialState(LeakTestRunning);
ihsm.registerStateNames({ LeakTestRunning, LeakTestDone });

describe("LspActorRegistry leak prevention", () => {
  it("remove clears actor and request mapping", () => {
    const registry = new LspActorRegistry();
    const requestId = registry.allocateId("test/leak");
    const actorId = lspActorId("test/leak", requestId);
    const ctx: LeakTestCtx = {
      typeId: LSP_ACTOR_TYPE_IDS.testLeak,
      actorId,
    };
    const hsm = createLspHsm(LeakTestTop, ctx);
    registry.register(actorId, LSP_ACTOR_TYPE_IDS.testLeak, hsm, requestId);
    expect(registry.size()).to.equal(1);
    registry.remove(actorId);
    expect(registry.size()).to.equal(0);
    expect(registry.isCancelled(requestId)).to.be.false;
  });

  it("notification HSM removes itself after completion", async () => {
    const server = mockLspServer();
    const doc = createCbsDocument("file:///leak.cbs", "x\n", 1);
    spawnDidOpenNotification(server, doc);
    await new Promise((r) => setTimeout(r, 50));
    expect(server.registry.size()).to.equal(0);
  });
});
