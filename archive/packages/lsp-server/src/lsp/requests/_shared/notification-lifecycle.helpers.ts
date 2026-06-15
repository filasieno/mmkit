import type * as ihsm from "ihsm";
import { createLspHsm } from "../../../lsp/lsp-hsm-factory";
import type { LspServerContext } from "../../lsp-server-context";
import { lspActorId } from "../../registry/lsp-actor-ids";
import type { LspRequestId } from "../../registry/lsp-actor-registry";
import type { LspActorCtxFor } from "../../registry/lsp-actor-context-map";
import type { LspActorTypeId } from "../../registry/lsp-actor-type-ids";

export interface NotificationBaseCtx<TTypeId extends LspActorTypeId = LspActorTypeId> {
  readonly typeId: TTypeId;
  server: LspServerContext;
  actorId: string;
  requestId: LspRequestId;
}

export function spawnNotificationHsm<
  TTypeId extends LspActorTypeId,
  Context extends LspActorCtxFor<TTypeId>,
  Protocol extends object,
>(
  server: LspServerContext,
  typeId: TTypeId,
  method: string,
  notificationId: LspRequestId,
  topState: ihsm.StateClass<Context, Protocol>,
  ctx: Omit<Context, "typeId" | "server" | "actorId" | "requestId">
): ihsm.Hsm<Context, Protocol> {
  const actorId = lspActorId(method, notificationId);
  const fullCtx = {
    typeId,
    ...ctx,
    server,
    actorId,
    requestId: notificationId,
  } as Context;
  const hsm = createLspHsm(topState, fullCtx);
  server.registry.register(actorId, typeId, hsm, notificationId);
  return hsm;
}

export function completeNotification(
  server: LspServerContext,
  actorId: string,
  transition: (state: ihsm.StateClass<object, object>) => void,
  completedState: ihsm.StateClass<object, object>
): void {
  transition(completedState);
}

export async function runNotificationBody(
  server: LspServerContext,
  actorId: string,
  body: () => Promise<void>,
  transition: (state: ihsm.StateClass<object, object>) => void,
  completedState: ihsm.StateClass<object, object>
): Promise<void> {
  try {
    await body();
    completeNotification(server, actorId, transition, completedState);
  } catch (err) {
    server.actuators.consoleError(String(err));
    completeNotification(server, actorId, transition, completedState);
  }
}
