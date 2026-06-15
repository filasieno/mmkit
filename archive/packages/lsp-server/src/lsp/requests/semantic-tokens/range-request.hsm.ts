import * as ihsm from "ihsm";
import type { CancellationToken, SemanticTokens, SemanticTokensParams } from "vscode-languageserver/node";
import type { Range } from "vscode-languageserver-types";
import { createLspHsm } from "../../../lsp/lsp-hsm-factory";
import type { LspServerContext } from "../../lsp-server-context";
import { lspActorId } from "../../registry/lsp-actor-ids";
import { LSP_ACTOR_TYPE_IDS } from "../../registry/lsp-actor-type-ids";
import type { CancellableRequestDeferred } from "../../cancellation/cancellable-request-deferred";
import type { WorkDoneTracker } from "../../progress/work-done-tracker";
import { provideSemanticTokensRange } from "../../semantic-tokens/provider";
import {
  beginRequestProgress,
  bindRequestCompleter,
  cancelInFlight,
  completeRequestSuccess,
  createRequestDeferred,
  failRequestError,
  finishCancelled,
} from "../_shared/request-lifecycle.helpers";

const METHOD = "textDocument/semanticTokens/range";
const PROGRESS_TITLE = "Semantic tokens (range)";

export type SemanticTokensRangeParams = SemanticTokensParams & { range: Range };

export interface SemanticTokensRangeCtx {
  readonly typeId: typeof LSP_ACTOR_TYPE_IDS.semanticTokensRange;
  server: LspServerContext;
  actorId: string;
  requestId: string | number;
  params: SemanticTokensRangeParams;
  progressTracker?: WorkDoneTracker;
  deferred?: CancellableRequestDeferred<SemanticTokens>;
}

export interface SemanticTokensRangeProtocol {
  start(): void;
  collect(): void;
  asyncStarted(): void;
  resolved(result: SemanticTokens): void;
  rejected(err: unknown): void;
  cancelled(): void;
  cancel(): void;
}

export class SemanticTokensRangeTop extends ihsm.TopState<
  SemanticTokensRangeCtx,
  SemanticTokensRangeProtocol
> {
  protected finishCancelled(): void {
    finishCancelled(
      this.ctx.server.registry,
      this.ctx.requestId,
      this.ctx.progressTracker,
      (s) => this.transition(s),
      SemanticTokensRangeCompleted
    );
  }

  cancel(): void {
    cancelInFlight(
      this.ctx.deferred,
      this.ctx.server.registry,
      this.ctx.requestId,
      this.ctx.progressTracker,
      (s) => this.transition(s),
      SemanticTokensRangeCompleted
    );
  }
}

export class SemanticTokensRangeReceived extends SemanticTokensRangeTop {
  onEntry(): void {
    this.postNow("start");
  }

  start(): void {
    this.transition(SemanticTokensRangeRunning);
  }
}

export class SemanticTokensRangeRunning extends SemanticTokensRangeTop {
  onEntry(): void {
    this.ctx.progressTracker = beginRequestProgress(
      this.ctx.server.actuators,
      this.ctx.requestId,
      PROGRESS_TITLE
    );
    this.ctx.deferred = createRequestDeferred(
      this.hsm as unknown as ihsm.Hsm,
      this.ctx.requestId,
      this.ctx.server.registry
    );
    this.postNow("collect");
  }

  collect(): void {
    this.ctx.progressTracker?.report("Collecting tokens", 40);
    void this.ctx.deferred!.run(async (signal) => {
      if (signal.aborted) throw new Error("cancelled");
      const tokens = await provideSemanticTokensRange(
        this.ctx.server.documentRegistry,
        this.ctx.params.textDocument.uri,
        this.ctx.params.range
      );
      if (signal.aborted) throw new Error("cancelled");
      this.ctx.progressTracker?.report("Encoding", 85);
      return tokens;
    });
  }

  asyncStarted(): void {
    this.transition(SemanticTokensRangeAwaitingAsync);
  }
}

export class SemanticTokensRangeAwaitingAsync extends SemanticTokensRangeTop {
  resolved(result: SemanticTokens): void {
    completeRequestSuccess(
      this.ctx.server.registry,
      this.ctx.requestId,
      this.ctx.progressTracker,
      result,
      (s) => this.transition(s),
      SemanticTokensRangeCompleted
    );
  }

  rejected(err: unknown): void {
    failRequestError(
      this.ctx.server.registry,
      this.ctx.requestId,
      this.ctx.progressTracker,
      this.ctx.server.actuators,
      err,
      (s) => this.transition(s),
      SemanticTokensRangeCompleted
    );
  }

  cancelled(): void {
    this.finishCancelled();
  }
}

export class SemanticTokensRangeCompleted extends SemanticTokensRangeTop {
  onEntry(): void {
    this.ctx.server.registry.remove(this.ctx.actorId);
  }
}

ihsm.InitialState(SemanticTokensRangeReceived);

ihsm.registerStateNames({
  SemanticTokensRangeReceived,
  SemanticTokensRangeRunning,
  SemanticTokensRangeAwaitingAsync,
  SemanticTokensRangeCompleted,
});

export function runSemanticTokensRangeRequest(
  server: LspServerContext,
  params: SemanticTokensRangeParams,
  cancelToken?: CancellationToken
): Promise<SemanticTokens> {
  const requestId = server.registry.allocateId(METHOD);
  const actorId = lspActorId(METHOD, requestId);
  const resultPromise = bindRequestCompleter<SemanticTokens>(server.registry, requestId, cancelToken);
  const ctx: SemanticTokensRangeCtx = {
    typeId: LSP_ACTOR_TYPE_IDS.semanticTokensRange,
    server,
    actorId,
    requestId,
    params,
  };
  const hsm = createLspHsm(SemanticTokensRangeTop, ctx);
  server.registry.register(actorId, LSP_ACTOR_TYPE_IDS.semanticTokensRange, hsm, requestId);
  return resultPromise;
}
