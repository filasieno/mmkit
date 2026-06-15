import * as ihsm from "ihsm";
import { MessageType, type DidSaveNotebookDocumentParams } from "vscode-languageserver/node";
import type { LspServerContext } from "../../lsp-server-context";
import { publishDiagnosticsForUri } from "../../services/diagnostics-service";
import { LSP_ACTOR_TYPE_IDS } from "../../registry/lsp-actor-type-ids";
import {
  type NotificationBaseCtx,
  runNotificationBody,
  spawnNotificationHsm,
} from "../_shared/notification-lifecycle.helpers";

const METHOD = "notebookDocument/didSave";

export interface NotebookDidSaveCtx extends NotificationBaseCtx<typeof LSP_ACTOR_TYPE_IDS.notebookDidSave> {
  params: DidSaveNotebookDocumentParams;
}

export interface NotebookDidSaveProtocol {
  start(): void;
  run(): void;
}

export class NotebookDidSaveTop extends ihsm.TopState<NotebookDidSaveCtx, NotebookDidSaveProtocol> {}

export class NotebookDidSaveReceived extends NotebookDidSaveTop {
  onEntry(): void {
    this.postNow("start");
  }

  start(): void {
    this.transition(NotebookDidSaveRunning);
  }
}

export class NotebookDidSaveRunning extends NotebookDidSaveTop {
  onEntry(): void {
    this.postNow("run");
  }

  async run(): Promise<void> {
    await runNotificationBody(
      this.ctx.server,
      this.ctx.actorId,
      async () => {
        const notebookUri = this.ctx.params.notebookDocument.uri;
        this.ctx.server.actuators.logMessage(
          MessageType.Log,
          `notebook saved ${notebookUri}`
        );
        const cellUris = this.ctx.server.notebookRegistry.get(notebookUri)?.cellUris ?? [];
        for (const uri of cellUris) {
          if (this.ctx.server.documents.get(uri)) {
            await publishDiagnosticsForUri(this.ctx.server, uri);
          }
        }
      },
      (s) => this.transition(s),
      NotebookDidSaveCompleted
    );
  }
}

export class NotebookDidSaveCompleted extends NotebookDidSaveTop {
  onEntry(): void {
    this.ctx.server.registry.remove(this.ctx.actorId);
  }
}

ihsm.InitialState(NotebookDidSaveReceived);

ihsm.registerStateNames({
  NotebookDidSaveReceived,
  NotebookDidSaveRunning,
  NotebookDidSaveCompleted,
});

export function spawnNotebookDidSave(
  server: LspServerContext,
  params: DidSaveNotebookDocumentParams
): void {
  const notificationId = server.registry.allocateId(METHOD);
  spawnNotificationHsm(
    server,
    LSP_ACTOR_TYPE_IDS.notebookDidSave,
    METHOD,
    notificationId,
    NotebookDidSaveTop,
    { params }
  );
}
