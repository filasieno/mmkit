import { normalizeLspTraceSetting, type LspTraceSetting } from "./client-config";

/** Mirrors `vscode-languageclient` Trace enum (Off=0, Messages=1, Verbose=2). */
export const LSP_TRACE_OFF = 0;
export const LSP_TRACE_MESSAGES = 1;
export const LSP_TRACE_VERBOSE = 2;

export function resolveLspTraceLevel(level: LspTraceSetting): number {
  switch (level) {
    case "verbose":
      return LSP_TRACE_VERBOSE;
    case "messages":
      return LSP_TRACE_MESSAGES;
    default:
      return LSP_TRACE_OFF;
  }
}

export function traceFromConfigurationValue(raw: string | undefined): number {
  return resolveLspTraceLevel(normalizeLspTraceSetting(raw));
}
