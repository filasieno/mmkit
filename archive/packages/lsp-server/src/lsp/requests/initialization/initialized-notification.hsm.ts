import * as ihsm from "ihsm";
import type { LspServerContext } from "../../lsp-server-context";
import { otelLogger } from "../../../shared/telemetry/otel";
import { LSP_ACTOR_TYPE_IDS } from "../../registry/lsp-actor-type-ids";
import {
  type NotificationBaseCtx,
  runNotificationBody,
  spawnNotificationHsm,
} from "../_shared/notification-lifecycle.helpers";

const METHOD = "initialized";

export interface InitializedCtx
  extends NotificationBaseCtx<typeof LSP_ACTOR_TYPE_IDS.initialized> {}

export interface InitializedProtocol {
  start(): void;
  run(): void;
}

export class InitializedTop extends ihsm.TopState<InitializedCtx, InitializedProtocol> {}

export class InitializedReceived extends InitializedTop {
  onEntry(): void {
    this.postNow("start");
  }

  start(): void {
    this.transition(InitializedRunning);
  }
}

export class InitializedRunning extends InitializedTop {
  onEntry(): void {
    this.postNow("run");
  }

  async run(): Promise<void> {
    await runNotificationBody(
      this.ctx.server,
      this.ctx.actorId,
      async () => {
        this.ctx.server.readiness.lspInitialized = true;
        otelLogger("mmkit-lsp").emit({ severityText: "INFO", body: "LSP initialized" });
      },
      (s) => this.transition(s),
      InitializedCompleted
    );
  }
}

export class InitializedCompleted extends InitializedTop {
  onEntry(): void {
    this.ctx.server.registry.remove(this.ctx.actorId);
  }
}

ihsm.InitialState(InitializedReceived);

ihsm.registerStateNames({
  InitializedReceived,
  InitializedRunning,
  InitializedCompleted,
});

export function spawnInitializedNotification(server: LspServerContext): void {
  const notificationId = server.registry.allocateId(METHOD);
  spawnNotificationHsm(server, LSP_ACTOR_TYPE_IDS.initialized, METHOD, notificationId, InitializedTop, {});
}
