import * as ihsm from "ihsm";
import { createLspHsm } from "../../../lsp/lsp-hsm-factory";
import { lspActorId } from "../../registry/lsp-actor-ids";
import type { LspActorCtxFor } from "../../registry/lsp-actor-context-map";
import { LSP_ACTOR_TYPE_IDS } from "../../registry/lsp-actor-type-ids";
import type { NotificationWorkCtx } from "./types";

export interface NotificationExecutorProtocol {
  start(): void;
  run(): void;
}

export class NotificationExecutorTop extends ihsm.TopState<
  NotificationWorkCtx<unknown>,
  NotificationExecutorProtocol
> {}

export class NotificationReceived extends NotificationExecutorTop {
  onEntry(): void {
    this.postNow("start");
  }

  start(): void {
    this.transition(NotificationRunning);
  }
}

export class NotificationRunning extends NotificationExecutorTop {
  onEntry(): void {
    this.postNow("run");
  }

  async run(): Promise<void> {
    try {
      await this.ctx.work(this.ctx.server, this.ctx.params);
      this.transition(NotificationCompleted);
    } catch (err) {
      this.ctx.server.actuators.consoleError(String(err));
      this.transition(NotificationCompleted);
    }
  }
}

export class NotificationCompleted extends NotificationExecutorTop {
  onEntry(): void {
    this.ctx.server.registry.remove(this.ctx.actorId);
  }
}

ihsm.InitialState(NotificationReceived);

ihsm.registerStateNames({
  NotificationReceived,
  NotificationRunning,
  NotificationCompleted,
});

export function registerNotificationExecutor<TParams>(
  server: NotificationWorkCtx<TParams>["server"],
  spec: Omit<
    NotificationWorkCtx<TParams>,
    "server" | "actorId" | "requestId" | "progressToken" | "typeId"
  > & {
    notificationId: string | number;
  }
): ihsm.Hsm<NotificationWorkCtx<TParams>, NotificationExecutorProtocol> {
  const actorId = lspActorId(spec.method, spec.notificationId);
  const ctx: NotificationWorkCtx<TParams> = {
    typeId: LSP_ACTOR_TYPE_IDS.notificationExecutor,
    server,
    actorId,
    requestId: spec.notificationId,
    progressToken: spec.notificationId,
    method: spec.method,
    params: spec.params,
    work: spec.work,
  };
  const hsm = createLspHsm(
    NotificationExecutorTop as ihsm.StateClass<
      NotificationWorkCtx<TParams>,
      NotificationExecutorProtocol
    >,
    ctx
  );
  server.registry.register(
    actorId,
    LSP_ACTOR_TYPE_IDS.notificationExecutor,
    hsm as ihsm.Hsm<LspActorCtxFor<typeof LSP_ACTOR_TYPE_IDS.notificationExecutor>, object>,
    spec.notificationId
  );
  return hsm;
}
