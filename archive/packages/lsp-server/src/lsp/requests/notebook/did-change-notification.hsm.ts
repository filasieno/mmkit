import * as ihsm from "ihsm";
import type { DidChangeNotebookDocumentParams } from "vscode-languageserver/node";
import type { LspServerContext } from "../../lsp-server-context";
import { publishDiagnosticsForUri } from "../../services/diagnostics-service";
import { LSP_ACTOR_TYPE_IDS } from "../../registry/lsp-actor-type-ids";
import {
  type NotificationBaseCtx,
  runNotificationBody,
  spawnNotificationHsm,
} from "../_shared/notification-lifecycle.helpers";
import { cellDocumentUri } from "./notebook.helpers";

const METHOD = "notebookDocument/didChange";

export interface NotebookDidChangeCtx extends NotificationBaseCtx<typeof LSP_ACTOR_TYPE_IDS.notebookDidChange> {
  params: DidChangeNotebookDocumentParams;
}

export interface NotebookDidChangeProtocol {
  start(): void;
  run(): void;
}

export class NotebookDidChangeTop extends ihsm.TopState<
  NotebookDidChangeCtx,
  NotebookDidChangeProtocol
> {}

export class NotebookDidChangeReceived extends NotebookDidChangeTop {
  onEntry(): void {
    this.postNow("start");
  }

  start(): void {
    this.transition(NotebookDidChangeRunning);
  }
}

export class NotebookDidChangeRunning extends NotebookDidChangeTop {
  onEntry(): void {
    this.postNow("run");
  }

  async run(): Promise<void> {
    await runNotificationBody(
      this.ctx.server,
      this.ctx.actorId,
      async () => {
        const event = this.ctx.params;
        const structure = event.change.cells?.structure as
          | { array?: { cells?: Array<{ document: string | { uri: string } }> } }
          | undefined;
        const cellUris = structure?.array?.cells?.map((c) => cellDocumentUri(c.document));
        this.ctx.server.notebookRegistry.trackChange(
          event.notebookDocument.uri,
          event.notebookDocument.version,
          cellUris
        );

        const textChanges = event.change.cells?.textContent ?? [];
        for (const cellChange of textChanges) {
          const uri = cellDocumentUri(cellChange.document);
          const doc = this.ctx.server.documents.get(uri);
          if (doc) {
            this.ctx.server.documentRegistry.trackSyncedDocument(doc);
            await publishDiagnosticsForUri(this.ctx.server, uri);
          }
        }
      },
      (s) => this.transition(s),
      NotebookDidChangeCompleted
    );
  }
}

export class NotebookDidChangeCompleted extends NotebookDidChangeTop {
  onEntry(): void {
    this.ctx.server.registry.remove(this.ctx.actorId);
  }
}

ihsm.InitialState(NotebookDidChangeReceived);

ihsm.registerStateNames({
  NotebookDidChangeReceived,
  NotebookDidChangeRunning,
  NotebookDidChangeCompleted,
});

export function spawnNotebookDidChange(
  server: LspServerContext,
  params: DidChangeNotebookDocumentParams
): void {
  const notificationId = server.registry.allocateId(METHOD);
  spawnNotificationHsm(
    server,
    LSP_ACTOR_TYPE_IDS.notebookDidChange,
    METHOD,
    notificationId,
    NotebookDidChangeTop,
    { params }
  );
}
