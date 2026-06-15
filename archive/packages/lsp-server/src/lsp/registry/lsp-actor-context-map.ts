import type { InitializeRequestCtx } from "../requests/initialization/initialize-request.hsm";
import type { InitializedCtx } from "../requests/initialization/initialized-notification.hsm";
import type { NotebookDidChangeCtx } from "../requests/notebook/did-change-notification.hsm";
import type { NotebookDidCloseCtx } from "../requests/notebook/did-close-notification.hsm";
import type { NotebookDidOpenCtx } from "../requests/notebook/did-open-notification.hsm";
import type { NotebookDidSaveCtx } from "../requests/notebook/did-save-notification.hsm";
import type { SemanticTokensFullCtx } from "../requests/semantic-tokens/full-request.hsm";
import type { SemanticTokensRangeCtx } from "../requests/semantic-tokens/range-request.hsm";
import type { DidChangeCtx } from "../requests/text-document/did-change-notification.hsm";
import type { DidCloseCtx } from "../requests/text-document/did-close-notification.hsm";
import type { DidOpenCtx } from "../requests/text-document/did-open-notification.hsm";
import type { DidSaveCtx } from "../requests/text-document/did-save-notification.hsm";
import type { WillSaveCtx } from "../requests/text-document/will-save-notification.hsm";
import type { WillSaveWaitUntilCtx } from "../requests/text-document/will-save-wait-until-request.hsm";
import type { NotificationWorkCtx, RequestWorkCtx } from "../requests/_shared/types";
import { LSP_ACTOR_TYPE_IDS, type LspActorTypeId } from "./lsp-actor-type-ids";

/** @internal registry leak tests */
export interface LeakTestCtx {
  readonly typeId: typeof LSP_ACTOR_TYPE_IDS.testLeak;
  actorId: string;
}

export interface LspActorCtxMap {
  [LSP_ACTOR_TYPE_IDS.initialize]: InitializeRequestCtx;
  [LSP_ACTOR_TYPE_IDS.initialized]: InitializedCtx;
  [LSP_ACTOR_TYPE_IDS.textDocumentDidOpen]: DidOpenCtx;
  [LSP_ACTOR_TYPE_IDS.textDocumentDidChange]: DidChangeCtx;
  [LSP_ACTOR_TYPE_IDS.textDocumentDidClose]: DidCloseCtx;
  [LSP_ACTOR_TYPE_IDS.textDocumentWillSave]: WillSaveCtx;
  [LSP_ACTOR_TYPE_IDS.textDocumentWillSaveWaitUntil]: WillSaveWaitUntilCtx;
  [LSP_ACTOR_TYPE_IDS.textDocumentDidSave]: DidSaveCtx;
  [LSP_ACTOR_TYPE_IDS.notebookDidOpen]: NotebookDidOpenCtx;
  [LSP_ACTOR_TYPE_IDS.notebookDidChange]: NotebookDidChangeCtx;
  [LSP_ACTOR_TYPE_IDS.notebookDidClose]: NotebookDidCloseCtx;
  [LSP_ACTOR_TYPE_IDS.notebookDidSave]: NotebookDidSaveCtx;
  [LSP_ACTOR_TYPE_IDS.semanticTokensFull]: SemanticTokensFullCtx;
  [LSP_ACTOR_TYPE_IDS.semanticTokensRange]: SemanticTokensRangeCtx;
  [LSP_ACTOR_TYPE_IDS.requestExecutor]: RequestWorkCtx<unknown, unknown>;
  [LSP_ACTOR_TYPE_IDS.notificationExecutor]: NotificationWorkCtx<unknown>;
  [LSP_ACTOR_TYPE_IDS.testLeak]: LeakTestCtx;
}

export type LspActorCtxFor<T extends LspActorTypeId> = LspActorCtxMap[T];
