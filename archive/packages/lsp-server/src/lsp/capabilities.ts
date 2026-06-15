import { TextDocumentSyncKind, type ServerCapabilities } from "vscode-languageserver/node";
import {
  LANGUAGE_ID,
  NOTEBOOK_TYPE,
  TEXT_DOCUMENT_SYNC_INCREMENTAL,
  type MmkitInitializeExtension,
} from "@mmkit/shared";
import { SEMANTIC_TOKEN_MODIFIERS, SEMANTIC_TOKEN_TYPES } from "./semantic-tokens/legend";

/** Server initialize capabilities (exported for contract tests). */
export function buildServerCapabilities(mmkitExtension?: MmkitInitializeExtension): ServerCapabilities {
  if (TextDocumentSyncKind.Incremental !== TEXT_DOCUMENT_SYNC_INCREMENTAL) {
    throw new Error("TextDocumentSyncKind.Incremental must equal 2");
  }

  return {
    textDocumentSync: {
      openClose: true,
      change: TextDocumentSyncKind.Incremental,
      willSave: true,
      willSaveWaitUntil: true,
      save: { includeText: true },
    },
    notebookDocumentSync: {
      notebookSelector: [{ notebook: NOTEBOOK_TYPE, cells: [{ language: LANGUAGE_ID }] }],
      save: true,
    },
    semanticTokensProvider: {
      legend: {
        tokenTypes: [...SEMANTIC_TOKEN_TYPES],
        tokenModifiers: [...SEMANTIC_TOKEN_MODIFIERS],
      },
      full: true,
      range: true,
      workDoneProgress: true,
    },
    mmkit: mmkitExtension ?? {
      serverControl: true,
      otel: true,
      mcpHttpPort: Number(process.env.MMKIT_HTTP_PORT ?? "28080"),
    },
  } as ServerCapabilities;
}
