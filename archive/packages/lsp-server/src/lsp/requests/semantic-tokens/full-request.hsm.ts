import * as ihsm from "ihsm";
import type { CancellationToken, SemanticTokens, SemanticTokensParams } from "vscode-languageserver/node";
import { createLspHsm } from "../../../lsp/lsp-hsm-factory";
import type { LspServerContext } from "../../lsp-server-context";
import { lspActorId } from "../../registry/lsp-actor-ids";
import { LSP_ACTOR_TYPE_IDS } from "../../registry/lsp-actor-type-ids";
import type { CancellableRequestDeferred } from "../../cancellation/cancellable-request-deferred";
import type { WorkDoneTracker } from "../../progress/work-done-tracker";
import { provideSemanticTokensFull } from "../../semantic-tokens/provider";
import {
  beginRequestProgress,
  bindRequestCompleter,
  cancelInFlight,
  completeRequestSuccess,
  createRequestDeferred,
  failRequestError,
  finishCancelled,
} from "../_shared/request-lifecycle.helpers";

const METHOD = "textDocument/semanticTokens/full";
const PROGRESS_TITLE = "Semantic tokens (full)";

export interface SemanticTokensFullCtx {
  readonly typeId: typeof LSP_ACTOR_TYPE_IDS.semanticTokensFull;
  server: LspServerContext;
  actorId: string;
  requestId: string | number;
  params: SemanticTokensParams;
  progressTracker?: WorkDoneTracker;
  deferred?: CancellableRequestDeferred<SemanticTokens>;
}

export interface SemanticTokensFullProtocol {
  start(): void;
  collect(): void;
  asyncStarted(): void;
  resolved(result: SemanticTokens): void;
  rejected(err: unknown): void;
  cancelled(): void;
  cancel(): void;
}

export class SemanticTokensFullTop extends ihsm.TopState<
  SemanticTokensFullCtx,
  SemanticTokensFullProtocol
> {
  protected finishCancelled(): void {
    finishCancelled(
      this.ctx.server.registry,
      this.ctx.requestId,
      this.ctx.progressTracker,
      (s) => this.transition(s),
      SemanticTokensFullCompleted
    );
  }

  cancel(): void {
    cancelInFlight(
      this.ctx.deferred,
      this.ctx.server.registry,
      this.ctx.requestId,
      this.ctx.progressTracker,
      (s) => this.transition(s),
      SemanticTokensFullCompleted
    );
  }
}

export class SemanticTokensFullReceived extends SemanticTokensFullTop {
  onEntry(): void {
    this.postNow("start");
  }

  start(): void {
    this.transition(SemanticTokensFullRunning);
  }
}

export class SemanticTokensFullRunning extends SemanticTokensFullTop {
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
      const tokens = await provideSemanticTokensFull(
        this.ctx.server.documentRegistry,
        this.ctx.params.textDocument.uri
      );
      if (signal.aborted) throw new Error("cancelled");
      this.ctx.progressTracker?.report("Encoding", 85);
      return tokens;
    });
  }

  asyncStarted(): void {
    this.transition(SemanticTokensFullAwaitingAsync);
  }
}

export class SemanticTokensFullAwaitingAsync extends SemanticTokensFullTop {
  resolved(result: SemanticTokens): void {
    completeRequestSuccess(
      this.ctx.server.registry,
      this.ctx.requestId,
      this.ctx.progressTracker,
      result,
      (s) => this.transition(s),
      SemanticTokensFullCompleted
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
      SemanticTokensFullCompleted
    );
  }

  cancelled(): void {
    this.finishCancelled();
  }
}

export class SemanticTokensFullCompleted extends SemanticTokensFullTop {
  onEntry(): void {
    this.ctx.server.registry.remove(this.ctx.actorId);
  }
}

ihsm.InitialState(SemanticTokensFullReceived);

ihsm.registerStateNames({
  SemanticTokensFullReceived,
  SemanticTokensFullRunning,
  SemanticTokensFullAwaitingAsync,
  SemanticTokensFullCompleted,
});

export function runSemanticTokensFullRequest(
  server: LspServerContext,
  params: SemanticTokensParams,
  cancelToken?: CancellationToken
): Promise<SemanticTokens> {
  const requestId = server.registry.allocateId(METHOD);
  const actorId = lspActorId(METHOD, requestId);
  const resultPromise = bindRequestCompleter<SemanticTokens>(server.registry, requestId, cancelToken);
  const ctx: SemanticTokensFullCtx = {
    typeId: LSP_ACTOR_TYPE_IDS.semanticTokensFull,
    server,
    actorId,
    requestId,
    params,
  };
  const hsm = createLspHsm(SemanticTokensFullTop, ctx);
  server.registry.register(actorId, LSP_ACTOR_TYPE_IDS.semanticTokensFull, hsm, requestId);
  return resultPromise;
}
