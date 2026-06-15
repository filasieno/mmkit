import type { CancellableRequestDeferred } from "../../cancellation/cancellable-request-deferred";
import type { LspServerContext } from "../../lsp-server-context";
import type { WorkDoneTracker } from "../../progress/work-done-tracker";
import type { LspRequestId } from "../../registry/lsp-actor-registry";
import { LSP_ACTOR_TYPE_IDS, type LspActorTypeId } from "../../registry/lsp-actor-type-ids";

export interface LspActorBaseCtx<TTypeId extends LspActorTypeId = LspActorTypeId> {
  readonly typeId: TTypeId;
  server: LspServerContext;
  actorId: string;
  requestId: LspRequestId;
  progressToken?: string | number;
}

export interface RequestWorkCtx<TParams, TResult>
  extends LspActorBaseCtx<typeof LSP_ACTOR_TYPE_IDS.requestExecutor> {
  method: string;
  params: TParams;
  progressTitle: string;
  work: (
    signal: AbortSignal,
    server: LspServerContext,
    params: TParams
  ) => Promise<TResult>;
  result?: TResult;
  deferred?: CancellableRequestDeferred<TResult>;
  progressTracker?: WorkDoneTracker;
}

export interface NotificationWorkCtx<TParams>
  extends LspActorBaseCtx<typeof LSP_ACTOR_TYPE_IDS.notificationExecutor> {
  method: string;
  params: TParams;
  work: (server: LspServerContext, params: TParams) => Promise<void>;
}
