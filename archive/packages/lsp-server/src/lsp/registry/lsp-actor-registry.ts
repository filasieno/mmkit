import type * as ihsm from "ihsm";
import type { LspActorCtxFor } from "./lsp-actor-context-map";
import type { LspActorTypeId } from "./lsp-actor-type-ids";

export type LspRequestId = string | number;

export interface RequestCompleter<TResult = unknown> {
  resolve(value: TResult): void;
  reject(error: unknown): void;
}

/** Stored actor — protocol is erased; narrow via {@link cast} using {@link LspActorCtxFor}. */
export interface RegisteredLspActor<T extends LspActorTypeId = LspActorTypeId> {
  readonly typeId: T;
  readonly hsm: ihsm.Hsm<LspActorCtxFor<T>, object>;
}

export class LspActorRegistry {
  private readonly actors = new Map<string, RegisteredLspActor>();
  private readonly byRequestId = new Map<LspRequestId, string>();
  private readonly completers = new Map<LspRequestId, RequestCompleter>();
  private readonly cancelled = new Set<LspRequestId>();
  private seq = 0;

  allocateId(method: string): LspRequestId {
    this.seq += 1;
    return `${method}#${this.seq}`;
  }

  register<T extends LspActorTypeId>(
    actorId: string,
    typeId: T,
    hsm: ihsm.Hsm<LspActorCtxFor<T>, object>,
    requestId?: LspRequestId
  ): void {
    this.actors.set(actorId, { typeId, hsm });
    if (requestId !== undefined) {
      this.byRequestId.set(requestId, actorId);
    }
  }

  /** Untyped peek — prefer {@link cast} for typed extraction. */
  get(actorId: string): RegisteredLspActor | undefined {
    return this.actors.get(actorId);
  }

  /** Typed extraction — returns undefined when actorId is missing or typeId mismatches. */
  cast<T extends LspActorTypeId>(actorId: string, typeId: T): RegisteredLspActor<T> | undefined {
    const entry = this.actors.get(actorId);
    if (!entry || entry.typeId !== typeId) {
      return undefined;
    }
    return entry as RegisteredLspActor<T>;
  }

  post(actorId: string, event: string, ...payload: unknown[]): void {
    const entry = this.actors.get(actorId);
    if (!entry) return;
    (entry.hsm.post as (name: string, ...args: unknown[]) => void)(event, ...payload);
  }

  registerCompleter<TResult>(requestId: LspRequestId, completer: RequestCompleter<TResult>): void {
    this.completers.set(requestId, completer as RequestCompleter);
  }

  completeRequest<TResult>(requestId: LspRequestId, result: TResult): void {
    const completer = this.completers.get(requestId);
    this.completers.delete(requestId);
    completer?.resolve(result);
  }

  failRequest(requestId: LspRequestId, error: unknown): void {
    const completer = this.completers.get(requestId);
    this.completers.delete(requestId);
    completer?.reject(error);
  }

  cancel(requestId: LspRequestId): void {
    if (this.cancelled.has(requestId)) return;
    this.cancelled.add(requestId);
    const actorId = this.byRequestId.get(requestId);
    if (actorId) {
      this.post(actorId, "cancel");
    }
  }

  isCancelled(requestId: LspRequestId): boolean {
    return this.cancelled.has(requestId);
  }

  clearCancellation(requestId: LspRequestId): void {
    this.cancelled.delete(requestId);
  }

  remove(actorId: string): void {
    this.actors.delete(actorId);
    for (const [requestId, id] of this.byRequestId) {
      if (id === actorId) {
        this.byRequestId.delete(requestId);
        this.cancelled.delete(requestId);
        this.completers.delete(requestId);
        break;
      }
    }
  }

  async sync(actorId: string): Promise<void> {
    await this.actors.get(actorId)?.hsm.sync();
  }

  size(): number {
    return this.actors.size;
  }

  ids(): string[] {
    return [...this.actors.keys()];
  }
}
