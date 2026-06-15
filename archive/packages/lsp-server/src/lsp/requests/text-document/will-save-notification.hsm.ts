import * as ihsm from "ihsm";
import type { TextDocument } from "vscode-languageserver-textdocument";
import { MessageType, type TextDocumentSaveReason } from "vscode-languageserver/node";
import type { LspServerContext } from "../../lsp-server-context";
import { LSP_ACTOR_TYPE_IDS } from "../../registry/lsp-actor-type-ids";
import {
  type NotificationBaseCtx,
  runNotificationBody,
  spawnNotificationHsm,
} from "../_shared/notification-lifecycle.helpers";

const METHOD = "textDocument/willSave";

export interface WillSaveEvent {
  document: TextDocument;
  reason: TextDocumentSaveReason;
}

export interface WillSaveCtx extends NotificationBaseCtx<typeof LSP_ACTOR_TYPE_IDS.textDocumentWillSave> {
  event: WillSaveEvent;
}

export interface WillSaveProtocol {
  start(): void;
  run(): void;
}

export class WillSaveTop extends ihsm.TopState<WillSaveCtx, WillSaveProtocol> {}

export class WillSaveReceived extends WillSaveTop {
  onEntry(): void {
    this.postNow("start");
  }

  start(): void {
    this.transition(WillSaveRunning);
  }
}

export class WillSaveRunning extends WillSaveTop {
  onEntry(): void {
    this.postNow("run");
  }

  async run(): Promise<void> {
    await runNotificationBody(
      this.ctx.server,
      this.ctx.actorId,
      async () => {
        const { document, reason } = this.ctx.event;
        this.ctx.server.actuators.logMessage(
          MessageType.Log,
          `will save ${document.uri} (reason=${String(reason)})`
        );
      },
      (s) => this.transition(s),
      WillSaveCompleted
    );
  }
}

export class WillSaveCompleted extends WillSaveTop {
  onEntry(): void {
    this.ctx.server.registry.remove(this.ctx.actorId);
  }
}

ihsm.InitialState(WillSaveReceived);

ihsm.registerStateNames({
  WillSaveReceived,
  WillSaveRunning,
  WillSaveCompleted,
});

export function spawnWillSaveNotification(server: LspServerContext, event: WillSaveEvent): void {
  const notificationId = server.registry.allocateId(METHOD);
  spawnNotificationHsm(
    server,
    LSP_ACTOR_TYPE_IDS.textDocumentWillSave,
    METHOD,
    notificationId,
    WillSaveTop,
    { event }
  );
}
