import * as ihsm from "ihsm";
import type { TextDocument } from "vscode-languageserver-textdocument";
import type { LspServerContext } from "../../lsp-server-context";
import { LSP_ACTOR_TYPE_IDS } from "../../registry/lsp-actor-type-ids";
import {
  type NotificationBaseCtx,
  runNotificationBody,
  spawnNotificationHsm,
} from "../_shared/notification-lifecycle.helpers";

const METHOD = "textDocument/didClose";

export interface DidCloseCtx extends NotificationBaseCtx<typeof LSP_ACTOR_TYPE_IDS.textDocumentDidClose> {
  document: TextDocument;
}

export interface DidCloseProtocol {
  start(): void;
  run(): void;
}

export class DidCloseTop extends ihsm.TopState<DidCloseCtx, DidCloseProtocol> {}

export class DidCloseReceived extends DidCloseTop {
  onEntry(): void {
    this.postNow("start");
  }

  start(): void {
    this.transition(DidCloseRunning);
  }
}

export class DidCloseRunning extends DidCloseTop {
  onEntry(): void {
    this.postNow("run");
  }

  async run(): Promise<void> {
    await runNotificationBody(
      this.ctx.server,
      this.ctx.actorId,
      async () => {
        const doc = this.ctx.document;
        this.ctx.server.documentRegistry.trackClose(doc.uri);
        this.ctx.server.metrics.documentsOpen.set(this.ctx.server.documentRegistry.openCount());
        this.ctx.server.diagnosticsPublisher.clear(doc.uri);
      },
      (s) => this.transition(s),
      DidCloseCompleted
    );
  }
}

export class DidCloseCompleted extends DidCloseTop {
  onEntry(): void {
    this.ctx.server.registry.remove(this.ctx.actorId);
  }
}

ihsm.InitialState(DidCloseReceived);

ihsm.registerStateNames({
  DidCloseReceived,
  DidCloseRunning,
  DidCloseCompleted,
});

export function spawnDidCloseNotification(server: LspServerContext, document: TextDocument): void {
  const notificationId = server.registry.allocateId(METHOD);
  spawnNotificationHsm(
    server,
    LSP_ACTOR_TYPE_IDS.textDocumentDidClose,
    METHOD,
    notificationId,
    DidCloseTop,
    { document }
  );
}
