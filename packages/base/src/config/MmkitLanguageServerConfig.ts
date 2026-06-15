/**
 * LSP message tracing forwarded to the MMKit Trace output channel.
 *
 * Mirrors VS Code's built-in `json.trace` semantics for language servers.
 */
export type MmkitLanguageServerTrace = "off" | "messages" | "verbose";

export const MMKIT_LANGUAGE_SERVER_TRACE_MODES = ["off", "messages", "verbose"] as const satisfies readonly MmkitLanguageServerTrace[];

/**
 * Host networking and diagnostics for the mmkit language server process.
 *
 * Mapped from VS Code `mmkit.languageServer.*` settings.
 */
export interface IMmkitLanguageServerConfig {
  /**
   * Trace LSP JSON-RPC messages to the MMKit Trace channel.
   * @default `off`
   */
  trace: MmkitLanguageServerTrace;

  /**
   * TCP port bound on the host for the language server protocol endpoint.
   * @default 16011
   */
  lspPort: number;

  /**
   * HTTP port for health, readiness, metrics, and MCP (`/mcp`).
   * @default 28080
   */
  httpPort: number;
}

export const DEFAULT_MMKIT_LANGUAGE_SERVER: IMmkitLanguageServerConfig = {
  trace: "off",
  lspPort: 16_011,
  httpPort: 28_080,
};
