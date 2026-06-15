import type { LanguageServerSettings, OperationalMode, OtelTraceLevel, } from "./types";
import { DEFAULT_LANGUAGE_SERVER, DEFAULT_RAW } from "./defaults";

export type { FieldMeta } from "./field-meta";
export { FIELD_REGISTRY } from "./field-registry";
export {
  DEFAULT_CLIENT,
  DEFAULT_LANGUAGE_SERVER,
  DEFAULT_RAW,
  DEFAULT_SERVER,
} from "./defaults";
export type {
  ChangeClass,
  ClientSettings,
  LanguageServerSettings,
  LaunchKind,
  OperationalMode,
  OtelTraceLevel,
  RawMmkitSettings,
  ServerSettings,
} from "./types";

const OTEL_LEVELS = new Set<OtelTraceLevel>(["trace", "debug", "info", "warn", "error", "off"]);

export function parseOperationalMode(value: unknown): OperationalMode {
  if (value === "internalServer" || value === "client" || value === "none") {
    return value;
  }
  return DEFAULT_RAW.operationalMode;
}

export function parseOtelTraceLevel(value: unknown): OtelTraceLevel {
  if (typeof value === "string" && OTEL_LEVELS.has(value as OtelTraceLevel)) {
    return value as OtelTraceLevel;
  }
  return DEFAULT_RAW.traceLevel;
}

export function parseLanguageServerTrace(value: unknown): LanguageServerSettings["trace"] {
  if (value === "off" || value === "messages" || value === "verbose") {
    return value;
  }
  return DEFAULT_LANGUAGE_SERVER.trace;
}
