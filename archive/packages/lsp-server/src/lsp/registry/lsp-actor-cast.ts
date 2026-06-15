import type * as ihsm from "ihsm";
import type { LspActorCtxFor } from "./lsp-actor-context-map";
import type { LspActorRegistry, RegisteredLspActor } from "./lsp-actor-registry";
import type { LspActorTypeId } from "./lsp-actor-type-ids";

/** Typed registry extraction — the only supported way to narrow a stored actor. */
export function castLspActor<T extends LspActorTypeId>(
  registry: LspActorRegistry,
  actorId: string,
  typeId: T
): RegisteredLspActor<T> | undefined {
  return registry.cast(actorId, typeId);
}

export function castLspActorHsm<T extends LspActorTypeId>(
  registry: LspActorRegistry,
  actorId: string,
  typeId: T
): ihsm.Hsm<LspActorCtxFor<T>, object> | undefined {
  return registry.cast(actorId, typeId)?.hsm;
}
