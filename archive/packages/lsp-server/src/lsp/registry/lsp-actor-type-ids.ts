/** Discriminant stored on every LSP actor context and registry entry. */
export const LSP_ACTOR_TYPE_IDS = {
  initialize: "lsp.initialize",
  initialized: "lsp.initialized",
  textDocumentDidOpen: "lsp.textDocument.didOpen",
  textDocumentDidChange: "lsp.textDocument.didChange",
  textDocumentDidClose: "lsp.textDocument.didClose",
  textDocumentWillSave: "lsp.textDocument.willSave",
  textDocumentWillSaveWaitUntil: "lsp.textDocument.willSaveWaitUntil",
  textDocumentDidSave: "lsp.textDocument.didSave",
  notebookDidOpen: "lsp.notebookDocument.didOpen",
  notebookDidChange: "lsp.notebookDocument.didChange",
  notebookDidClose: "lsp.notebookDocument.didClose",
  notebookDidSave: "lsp.notebookDocument.didSave",
  semanticTokensFull: "lsp.semanticTokens.full",
  semanticTokensRange: "lsp.semanticTokens.range",
  requestExecutor: "lsp._shared.requestExecutor",
  notificationExecutor: "lsp._shared.notificationExecutor",
  /** @internal registry leak tests */
  testLeak: "lsp.test.leak",
} as const;

export type LspActorTypeId = (typeof LSP_ACTOR_TYPE_IDS)[keyof typeof LSP_ACTOR_TYPE_IDS];
