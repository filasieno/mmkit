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

const METHOD = "textDocument/didChange";

export interface DidChangeCtx extends NotificationBaseCtx<typeof LSP_ACTOR_TYPE_IDS.textDocumentDidChange> {
  document: TextDocument;
}

export interface DidChangeProtocol {
  start(): void;
  run(): void;
}

export class DidChangeTop extends ihsm.TopState<DidChangeCtx, DidChangeProtocol> {}

export class DidChangeReceived extends DidChangeTop {
  onEntry(): void {
    this.postNow("start");
  }

  start(): void {
    this.transition(DidChangeRunning);
  }
}

export class DidChangeRunning extends DidChangeTop {
  onEntry(): void {
    this.postNow("run");
  }

  async run(): Promise<void> {
    await runNotificationBody(
      this.ctx.server,
      this.ctx.actorId,
      async () => {
        const doc = this.ctx.document;
        const sync = this.ctx.server.documentRegistry.trackSyncedDocument(doc);
        if (!sync.ok) {
          this.ctx.server.actuators.consoleError(
            `conceptbase-lsp: ignored stale document sync for ${doc.uri}`
          );
          return;
        }
        await publishDiagnosticsForUri(this.ctx.server, doc.uri);
      },
      (s) => this.transition(s),
      DidChangeCompleted
    );
  }
}

export class DidChangeCompleted extends DidChangeTop {
  onEntry(): void {
    this.ctx.server.registry.remove(this.ctx.actorId);
  }
}

ihsm.InitialState(DidChangeReceived);

ihsm.registerStateNames({
  DidChangeReceived,
  DidChangeRunning,
  DidChangeCompleted,
});

export function spawnDidChangeNotification(server: LspServerContext, document: TextDocument): void {
  const notificationId = server.registry.allocateId(METHOD);
  spawnNotificationHsm(
    server,
    LSP_ACTOR_TYPE_IDS.textDocumentDidChange,
    METHOD,
    notificationId,
    DidChangeTop,
    { document }
  );
}
