import * as ihsm from "ihsm";
import type { DidCloseNotebookDocumentParams } from "vscode-languageserver/node";
import type { LspServerContext } from "../../lsp-server-context";
import { LSP_ACTOR_TYPE_IDS } from "../../registry/lsp-actor-type-ids";
import {
  type NotificationBaseCtx,
  runNotificationBody,
  spawnNotificationHsm,
} from "../_shared/notification-lifecycle.helpers";

const METHOD = "notebookDocument/didClose";

export interface NotebookDidCloseCtx extends NotificationBaseCtx<typeof LSP_ACTOR_TYPE_IDS.notebookDidClose> {
  params: DidCloseNotebookDocumentParams;
}

export interface NotebookDidCloseProtocol {
  start(): void;
  run(): void;
}

export class NotebookDidCloseTop extends ihsm.TopState<
  NotebookDidCloseCtx,
  NotebookDidCloseProtocol
> {}

export class NotebookDidCloseReceived extends NotebookDidCloseTop {
  onEntry(): void {
    this.postNow("start");
  }

  start(): void {
    this.transition(NotebookDidCloseRunning);
  }
}

export class NotebookDidCloseRunning extends NotebookDidCloseTop {
  onEntry(): void {
    this.postNow("run");
  }

  async run(): Promise<void> {
    await runNotificationBody(
      this.ctx.server,
      this.ctx.actorId,
      async () => {
        this.ctx.server.notebookRegistry.trackClose(this.ctx.params.notebookDocument.uri);
      },
      (s) => this.transition(s),
      NotebookDidCloseCompleted
    );
  }
}

export class NotebookDidCloseCompleted extends NotebookDidCloseTop {
  onEntry(): void {
    this.ctx.server.registry.remove(this.ctx.actorId);
  }
}

ihsm.InitialState(NotebookDidCloseReceived);

ihsm.registerStateNames({
  NotebookDidCloseReceived,
  NotebookDidCloseRunning,
  NotebookDidCloseCompleted,
});

export function spawnNotebookDidClose(
  server: LspServerContext,
  params: DidCloseNotebookDocumentParams
): void {
  const notificationId = server.registry.allocateId(METHOD);
  spawnNotificationHsm(
    server,
    LSP_ACTOR_TYPE_IDS.notebookDidClose,
    METHOD,
    notificationId,
    NotebookDidCloseTop,
    { params }
  );
}
