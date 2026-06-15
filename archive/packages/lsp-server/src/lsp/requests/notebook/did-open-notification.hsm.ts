import * as ihsm from "ihsm";
import { LANGUAGE_ID, NOTEBOOK_TYPE } from "@mmkit/shared";
import type { DidOpenNotebookDocumentParams } from "vscode-languageserver/node";
import type { LspServerContext } from "../../lsp-server-context";
import { LSP_ACTOR_TYPE_IDS } from "../../registry/lsp-actor-type-ids";
import {
  type NotificationBaseCtx,
  runNotificationBody,
  spawnNotificationHsm,
} from "../_shared/notification-lifecycle.helpers";
import { cellDocumentUri } from "./notebook.helpers";

const METHOD = "notebookDocument/didOpen";

export interface NotebookDidOpenCtx extends NotificationBaseCtx<typeof LSP_ACTOR_TYPE_IDS.notebookDidOpen> {
  params: DidOpenNotebookDocumentParams;
}

export interface NotebookDidOpenProtocol {
  start(): void;
  run(): void;
}

export class NotebookDidOpenTop extends ihsm.TopState<NotebookDidOpenCtx, NotebookDidOpenProtocol> {}

export class NotebookDidOpenReceived extends NotebookDidOpenTop {
  onEntry(): void {
    this.postNow("start");
  }

  start(): void {
    this.transition(NotebookDidOpenRunning);
  }
}

export class NotebookDidOpenRunning extends NotebookDidOpenTop {
  onEntry(): void {
    this.postNow("run");
  }

  async run(): Promise<void> {
    await runNotificationBody(
      this.ctx.server,
      this.ctx.actorId,
      async () => {
        const event = this.ctx.params;
        const cellUris = event.notebookDocument.cells.map((c) => cellDocumentUri(c.document));
        this.ctx.server.notebookRegistry.trackOpen(
          event.notebookDocument.uri,
          event.notebookDocument.version,
          NOTEBOOK_TYPE,
          cellUris
        );
        for (const uri of cellUris) {
          this.ctx.server.actuators.consoleLog(`notebook open: ${LANGUAGE_ID} cell ${uri}`);
        }
      },
      (s) => this.transition(s),
      NotebookDidOpenCompleted
    );
  }
}

export class NotebookDidOpenCompleted extends NotebookDidOpenTop {
  onEntry(): void {
    this.ctx.server.registry.remove(this.ctx.actorId);
  }
}

ihsm.InitialState(NotebookDidOpenReceived);

ihsm.registerStateNames({
  NotebookDidOpenReceived,
  NotebookDidOpenRunning,
  NotebookDidOpenCompleted,
});

export function spawnNotebookDidOpen(
  server: LspServerContext,
  params: DidOpenNotebookDocumentParams
): void {
  const notificationId = server.registry.allocateId(METHOD);
  spawnNotificationHsm(
    server,
    LSP_ACTOR_TYPE_IDS.notebookDidOpen,
    METHOD,
    notificationId,
    NotebookDidOpenTop,
    { params }
  );
}
