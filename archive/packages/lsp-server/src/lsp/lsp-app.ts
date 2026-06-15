/* Transport entrypoints — logic lives in router/ + requests/ */
export { bindLspServer, startLspStdio, startLspTcp, type LspBindOptions } from "./router/lsp-router";
export type { LspBindOptions as LspAppOptions } from "./router/lsp-router";
