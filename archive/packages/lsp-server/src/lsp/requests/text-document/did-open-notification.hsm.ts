import * as ihsm from "ihsm";
import type { TextDocument } from "vscode-languageserver-textdocument";
import type { LspServerContext } from "../../lsp-server-context";
import { publishDiagnosticsForUri } from "../../services/diagnostics-service";
import { LSP_ACTOR_TYPE_IDS } from "../../registry/lsp-actor-type-ids";
import {
  type NotificationBaseCtx,
  runNotificationBody,
  spawnNotificationHsm,
} from "../_shared/notification-lifecycle.helpers";

const METHOD = "textDocument/didOpen";

export interface DidOpenCtx extends NotificationBaseCtx<typeof LSP_ACTOR_TYPE_IDS.textDocumentDidOpen> {
  document: TextDocument;
}

export interface DidOpenProtocol {
  start(): void;
  run(): void;
}

export class DidOpenTop extends ihsm.TopState<DidOpenCtx, DidOpenProtocol> {}

export class DidOpenReceived extends DidOpenTop {
  onEntry(): void {
    this.postNow("start");
  }

  start(): void {
    this.transition(DidOpenRunning);
  }
}

export class DidOpenRunning extends DidOpenTop {
  onEntry(): void {
    this.postNow("run");
  }

  async run(): Promise<void> {
    await runNotificationBody(
      this.ctx.server,
      this.ctx.actorId,
      async () => {
        const doc = this.ctx.document;
        this.ctx.server.documentRegistry.trackOpen(doc);
        this.ctx.server.metrics.documentsOpen.set(this.ctx.server.documentRegistry.openCount());
        await publishDiagnosticsForUri(this.ctx.server, doc.uri);
      },
      (s) => this.transition(s),
      DidOpenCompleted
    );
  }
}

export class DidOpenCompleted extends DidOpenTop {
  onEntry(): void {
    this.ctx.server.registry.remove(this.ctx.actorId);
  }
}

ihsm.InitialState(DidOpenReceived);

ihsm.registerStateNames({
  DidOpenReceived,
  DidOpenRunning,
  DidOpenCompleted,
});

export function spawnDidOpenNotification(server: LspServerContext, document: TextDocument): void {
  const notificationId = server.registry.allocateId(METHOD);
  spawnNotificationHsm(
    server,
    LSP_ACTOR_TYPE_IDS.textDocumentDidOpen,
    METHOD,
    notificationId,
    DidOpenTop,
    { document }
  );
}
