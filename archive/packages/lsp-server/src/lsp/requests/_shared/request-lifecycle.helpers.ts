import type { CancellationToken } from "vscode-languageserver/node";
import {
  CancelledLspRequestError,
  CancellableRequestDeferred,
} from "../../cancellation/cancellable-request-deferred";
import { WorkDoneTracker } from "../../progress/work-done-tracker";
import type { LspActuators } from "../../../lsp/ports/lsp-actuators";
import type { LspActorRegistry, LspRequestId } from "../../registry/lsp-actor-registry";
import type * as ihsm from "ihsm";

export function bindRequestCompleter<TResult>(
  registry: LspActorRegistry,
  requestId: LspRequestId,
  cancelToken?: CancellationToken
): Promise<TResult> {
  return new Promise((resolve, reject) => {
    registry.registerCompleter(requestId, { resolve, reject });
    if (cancelToken) {
      cancelToken.onCancellationRequested(() => registry.cancel(requestId));
    }
  });
}

export function beginRequestProgress(
  actuators: LspActuators,
  requestId: LspRequestId,
  title: string
): WorkDoneTracker {
  const tracker = new WorkDoneTracker(actuators, requestId);
  tracker.begin(title, true);
  return tracker;
}

export function createRequestDeferred<TResult>(
  owner: ihsm.Hsm,
  requestId: LspRequestId,
  registry: LspActorRegistry
): CancellableRequestDeferred<TResult> {
  return new CancellableRequestDeferred(owner, requestId, registry);
}

export function finishCancelled(
  registry: LspActorRegistry,
  requestId: LspRequestId,
  tracker: WorkDoneTracker | undefined,
  transition: (state: ihsm.StateClass<object, object>) => void,
  completedState: ihsm.StateClass<object, object>
): void {
  tracker?.end();
  registry.failRequest(requestId, new CancelledLspRequestError(requestId));
  transition(completedState);
}

export function completeRequestSuccess<TResult>(
  registry: LspActorRegistry,
  requestId: LspRequestId,
  tracker: WorkDoneTracker | undefined,
  result: TResult,
  transition: (state: ihsm.StateClass<object, object>) => void,
  completedState: ihsm.StateClass<object, object>
): void {
  if (registry.isCancelled(requestId)) {
    finishCancelled(registry, requestId, tracker, transition, completedState);
    return;
  }
  tracker?.report("Finishing", 95);
  registry.completeRequest(requestId, result);
  tracker?.end();
  transition(completedState);
}

export function failRequestError(
  registry: LspActorRegistry,
  requestId: LspRequestId,
  tracker: WorkDoneTracker | undefined,
  actuators: LspActuators,
  err: unknown,
  transition: (state: ihsm.StateClass<object, object>) => void,
  completedState: ihsm.StateClass<object, object>
): void {
  actuators.consoleError(String(err));
  tracker?.end();
  registry.failRequest(requestId, err);
  transition(completedState);
}

export function cancelInFlight(
  deferred: CancellableRequestDeferred<unknown> | undefined,
  registry: LspActorRegistry,
  requestId: LspRequestId,
  tracker: WorkDoneTracker | undefined,
  transition: (state: ihsm.StateClass<object, object>) => void,
  completedState: ihsm.StateClass<object, object>
): void {
  if (deferred) {
    deferred.cancel();
    return;
  }
  finishCancelled(registry, requestId, tracker, transition, completedState);
}
