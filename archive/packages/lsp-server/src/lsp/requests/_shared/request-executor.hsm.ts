import * as ihsm from "ihsm";
import {
  CancelledLspRequestError,
  CancellableRequestDeferred,
} from "../../cancellation/cancellable-request-deferred";
import { createLspHsm } from "../../../lsp/lsp-hsm-factory";
import { WorkDoneTracker } from "../../progress/work-done-tracker";
import { lspActorId } from "../../registry/lsp-actor-ids";
import type { LspActorCtxFor } from "../../registry/lsp-actor-context-map";
import { LSP_ACTOR_TYPE_IDS } from "../../registry/lsp-actor-type-ids";
import type { RequestWorkCtx } from "./types";

export interface RequestExecutorProtocol<TResult> {
  start(): void;
  asyncStarted(): void;
  resolved(result: TResult): void;
  rejected(err: unknown): void;
  cancelled(): void;
  cancel(): void;
}

export class RequestExecutorTop<TResult> extends ihsm.TopState<
  RequestWorkCtx<unknown, TResult>,
  RequestExecutorProtocol<TResult>
> {
  protected finishCancelled(): void {
    this.ctx.progressTracker?.end();
    this.ctx.server.registry.failRequest(
      this.ctx.requestId,
      new CancelledLspRequestError(this.ctx.requestId)
    );
    this.transition(RequestCompleted);
  }

  cancel(): void {
    if (this.ctx.deferred) {
      this.ctx.deferred.cancel();
      return;
    }
    this.finishCancelled();
  }
}

export class RequestReceived<TResult> extends RequestExecutorTop<TResult> {
  onEntry(): void {
    this.postNow("start");
  }

  start(): void {
    this.transition(RequestRunning);
  }
}

export class RequestRunning<TResult> extends RequestExecutorTop<TResult> {
  onEntry(): void {
    const tracker = new WorkDoneTracker(
      this.ctx.server.actuators,
      this.ctx.progressToken ?? this.ctx.requestId
    );
    this.ctx.progressTracker = tracker;
    tracker.begin(this.ctx.progressTitle, true);
    this.ctx.deferred = new CancellableRequestDeferred(
      this.hsm as unknown as ihsm.Hsm,
      this.ctx.requestId,
      this.ctx.server.registry
    );
    void this.ctx.deferred.run((signal) =>
      this.ctx.work(signal, this.ctx.server, this.ctx.params)
    );
  }

  asyncStarted(): void {
    this.transition(RequestAwaitingAsync);
  }
}

export class RequestAwaitingAsync<TResult> extends RequestExecutorTop<TResult> {
  resolved(result: TResult): void {
    this.ctx.result = result;
    this.ctx.progressTracker?.report("Finishing", 95);
    if (this.ctx.server.registry.isCancelled(this.ctx.requestId)) {
      this.finishCancelled();
      return;
    }
    this.ctx.server.registry.completeRequest(this.ctx.requestId, result);
    this.ctx.progressTracker?.end();
    this.transition(RequestCompleted);
  }

  rejected(err: unknown): void {
    this.ctx.server.actuators.consoleError(String(err));
    this.ctx.progressTracker?.end();
    this.ctx.server.registry.failRequest(this.ctx.requestId, err);
    this.transition(RequestCompleted);
  }

  cancelled(): void {
    this.finishCancelled();
  }
}

export class RequestCompleted<TResult> extends RequestExecutorTop<TResult> {
  onEntry(): void {
    this.ctx.server.registry.remove(this.ctx.actorId);
  }
}

ihsm.InitialState(RequestReceived);

ihsm.registerStateNames({
  RequestReceived,
  RequestRunning,
  RequestAwaitingAsync,
  RequestCompleted,
});

export function registerRequestExecutor<TParams, TResult>(
  server: RequestWorkCtx<TParams, TResult>["server"],
  spec: Omit<RequestWorkCtx<TParams, TResult>, "server" | "actorId" | "progressTracker" | "typeId"> & {
    requestId: RequestWorkCtx<TParams, TResult>["requestId"];
    progressToken?: string | number;
  }
): ihsm.Hsm<RequestWorkCtx<TParams, TResult>, RequestExecutorProtocol<TResult>> {
  const actorId = lspActorId(spec.method, spec.requestId);
  const progressToken = spec.progressToken ?? spec.requestId;
  const ctx: RequestWorkCtx<TParams, TResult> = {
    typeId: LSP_ACTOR_TYPE_IDS.requestExecutor,
    server,
    actorId,
    requestId: spec.requestId,
    progressToken,
    method: spec.method,
    params: spec.params,
    progressTitle: spec.progressTitle,
    work: spec.work,
  };
  const hsm = createLspHsm(
    RequestExecutorTop as ihsm.StateClass<
      RequestWorkCtx<TParams, TResult>,
      RequestExecutorProtocol<TResult>
    >,
    ctx
  );
  server.registry.register(
    actorId,
    LSP_ACTOR_TYPE_IDS.requestExecutor,
    hsm as ihsm.Hsm<LspActorCtxFor<typeof LSP_ACTOR_TYPE_IDS.requestExecutor>, object>,
    spec.requestId
  );
  return hsm;
}
