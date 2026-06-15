import * as ihsm from "ihsm";
import type { TextDocument } from "vscode-languageserver-textdocument";
import { MessageType } from "vscode-languageserver/node";
import type { LspServerContext } from "../../lsp-server-context";
import { publishDiagnosticsForUri } from "../../services/diagnostics-service";
import { LSP_ACTOR_TYPE_IDS } from "../../registry/lsp-actor-type-ids";
import {
  type NotificationBaseCtx,
  runNotificationBody,
  spawnNotificationHsm,
} from "../_shared/notification-lifecycle.helpers";

const METHOD = "textDocument/didSave";

export interface DidSaveEvent {
  document: TextDocument;
}

export interface DidSaveCtx extends NotificationBaseCtx<typeof LSP_ACTOR_TYPE_IDS.textDocumentDidSave> {
  event: DidSaveEvent;
}

export interface DidSaveProtocol {
  start(): void;
  run(): void;
}

export class DidSaveTop extends ihsm.TopState<DidSaveCtx, DidSaveProtocol> {}

export class DidSaveReceived extends DidSaveTop {
  onEntry(): void {
    this.postNow("start");
  }

  start(): void {
    this.transition(DidSaveRunning);
  }
}

export class DidSaveRunning extends DidSaveTop {
  onEntry(): void {
    this.postNow("run");
  }

  async run(): Promise<void> {
    await runNotificationBody(
      this.ctx.server,
      this.ctx.actorId,
      async () => {
        const doc = this.ctx.event.document;
        this.ctx.server.actuators.logMessage(
          MessageType.Log,
          `saved ${doc.uri} (version=${String(doc.version)})`
        );
        await publishDiagnosticsForUri(this.ctx.server, doc.uri);
      },
      (s) => this.transition(s),
      DidSaveCompleted
    );
  }
}

export class DidSaveCompleted extends DidSaveTop {
  onEntry(): void {
    this.ctx.server.registry.remove(this.ctx.actorId);
  }
}

ihsm.InitialState(DidSaveReceived);

ihsm.registerStateNames({
  DidSaveReceived,
  DidSaveRunning,
  DidSaveCompleted,
});

export function spawnDidSaveNotification(server: LspServerContext, event: DidSaveEvent): void {
  const notificationId = server.registry.allocateId(METHOD);
  spawnNotificationHsm(
    server,
    LSP_ACTOR_TYPE_IDS.textDocumentDidSave,
    METHOD,
    notificationId,
    DidSaveTop,
    { event }
  );
}
