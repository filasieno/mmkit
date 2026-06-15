import * as ihsm from "ihsm";
import type { TextEdit } from "vscode-languageserver/node";
import { createLspHsm } from "../../../lsp/lsp-hsm-factory";
import type { LspServerContext } from "../../lsp-server-context";
import { lspActorId } from "../../registry/lsp-actor-ids";
import { LSP_ACTOR_TYPE_IDS } from "../../registry/lsp-actor-type-ids";
import type { WillSaveEvent } from "./will-save-notification.hsm";

const METHOD = "textDocument/willSaveWaitUntil";

export interface WillSaveWaitUntilCtx {
  readonly typeId: typeof LSP_ACTOR_TYPE_IDS.textDocumentWillSaveWaitUntil;
  server: LspServerContext;
  actorId: string;
  requestId: string | number;
  event: WillSaveEvent;
  result?: TextEdit[];
}

export interface WillSaveWaitUntilProtocol {
  start(): void;
  resolveEdits(): void;
}

export class WillSaveWaitUntilTop extends ihsm.TopState<
  WillSaveWaitUntilCtx,
  WillSaveWaitUntilProtocol
> {}

export class WillSaveWaitUntilReceived extends WillSaveWaitUntilTop {
  onEntry(): void {
    this.postNow("start");
  }

  start(): void {
    this.transition(WillSaveWaitUntilRunning);
  }
}

export class WillSaveWaitUntilRunning extends WillSaveWaitUntilTop {
  onEntry(): void {
    this.postNow("resolveEdits");
  }

  resolveEdits(): void {
    // No pre-save formatting yet; empty edits keeps the buffer as-is.
    this.ctx.result = [];
    this.transition(WillSaveWaitUntilCompleted);
  }
}

export class WillSaveWaitUntilCompleted extends WillSaveWaitUntilTop {
  onEntry(): void {
    this.ctx.server.registry.remove(this.ctx.actorId);
  }
}

ihsm.InitialState(WillSaveWaitUntilReceived);

ihsm.registerStateNames({
  WillSaveWaitUntilReceived,
  WillSaveWaitUntilRunning,
  WillSaveWaitUntilCompleted,
});

export async function runWillSaveWaitUntilRequest(
  server: LspServerContext,
  event: WillSaveEvent
): Promise<TextEdit[]> {
  const requestId = server.registry.allocateId(METHOD);
  const actorId = lspActorId(METHOD, requestId);
  const ctx: WillSaveWaitUntilCtx = {
    typeId: LSP_ACTOR_TYPE_IDS.textDocumentWillSaveWaitUntil,
    server,
    actorId,
    requestId,
    event,
  };
  const hsm = createLspHsm(WillSaveWaitUntilTop, ctx);
  server.registry.register(actorId, LSP_ACTOR_TYPE_IDS.textDocumentWillSaveWaitUntil, hsm, requestId);
  await hsm.sync();
  return ctx.result ?? [];
}
