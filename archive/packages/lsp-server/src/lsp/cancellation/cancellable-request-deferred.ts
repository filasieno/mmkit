import type * as ihsm from "ihsm";
import type { LspActorRegistry, LspRequestId } from "../registry/lsp-actor-registry";

export class CancelledLspRequestError extends Error {
  constructor(requestId: LspRequestId) {
    super(`LSP request ${String(requestId)} cancelled`);
    this.name = "CancelledLspRequestError";
  }
}

/**
 * Promise-like async bridge for cancellable LSP request replies.
 * Posts `asyncStarted` when constructed so the owning HSM enters `AwaitingAsync`.
 */
export class CancellableRequestDeferred<T> {
  private readonly abortController = new AbortController();

  constructor(
    private readonly owner: ihsm.Hsm,
    private readonly requestId: LspRequestId,
    private readonly registry: LspActorRegistry
  ) {
    (owner.post as (event: string) => void)("asyncStarted");
  }

  get signal(): AbortSignal {
    return this.abortController.signal;
  }

  cancel(): void {
    this.abortController.abort();
  }

  async run(factory: (signal: AbortSignal) => Promise<T>): Promise<void> {
    try {
      const value = await factory(this.abortController.signal);
      if (this.registry.isCancelled(this.requestId) || this.abortController.signal.aborted) {
        (this.owner.post as (event: string) => void)("cancelled");
        return;
      }
      (this.owner.post as (event: string, payload: T) => void)("resolved", value);
    } catch (err) {
      if (this.registry.isCancelled(this.requestId) || this.abortController.signal.aborted) {
        (this.owner.post as (event: string) => void)("cancelled");
        return;
      }
      (this.owner.post as (event: string, payload: unknown) => void)("rejected", err);
    }
  }
}
