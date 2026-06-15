/**
 * How mmkit relates to a cbserver instance.
 *
 * - `none` — no server supervision and no outbound TCP client.
 * - `internalServer` — mmkit starts and supervises a local cbserver subprocess.
 * - `client` — mmkit connects to an existing cbserver over TCP.
 */
export type MmkitOperationalMode = "none" | "internalServer" | "client";

/**
 * OTEL-aligned minimum severity for mmkit diagnostic output channels.
 *
 * Does not change cbserver trace (`IMmkitServerRuntimeSettings.traceMode`).
 */
export type MmkitOtelTraceLevel = "trace" | "debug" | "info" | "warn" | "error" | "off";

export const MMKIT_OPERATIONAL_MODES = ["none", "internalServer", "client"] as const satisfies readonly MmkitOperationalMode[];
export const MMKIT_OTEL_TRACE_LEVELS = ["trace", "debug", "info", "warn", "error", "off"] as const satisfies readonly MmkitOtelTraceLevel[];

/**
 * Top-level mmkit process mode and extension diagnostics.
 *
 * Mapped from VS Code `mmkit.operationalMode` and `mmkit.traceLevel`.
 */
export interface IMmkitOperationalConfig {
  /**
   * Active supervision/connect strategy.
   * @default `internalServer`
   */
  operationalMode: MmkitOperationalMode;

  /**
   * Minimum OTEL severity emitted to the MMKit Trace output channel.
   * @default `trace`
   */
  traceLevel: MmkitOtelTraceLevel;
}

export const DEFAULT_MMKIT_OPERATIONAL: IMmkitOperationalConfig = {
  operationalMode: "internalServer",
  traceLevel: "trace",
};
