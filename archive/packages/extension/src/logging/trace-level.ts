import * as ihsm from "ihsm";
import type { OtelTraceLevel } from "../types";
import type { LogSeverity } from "./trace";

const SEVERITY_ORDER: LogSeverity[] = ["trace", "debug", "info", "warn", "error", "fatal"];

export function parseOtelTraceLevel(value: unknown): OtelTraceLevel {
  if (value === "trace" || value === "debug" || value === "info" || value === "warn" || value === "error" || value === "off") {
    return value;
  }
  return "trace";
}

export function otelToIhsmTraceLevel(level: OtelTraceLevel): ihsm.TraceLevel {
  switch (level) {
    case "trace":
      return ihsm.TraceLevel.VERBOSE_DEBUG;
    case "debug":
      return ihsm.TraceLevel.DEBUG;
    case "info":
    case "warn":
    case "error":
    case "off":
      return ihsm.TraceLevel.PRODUCTION;
    default:
      return ihsm.TraceLevel.DEBUG;
  }
}

export function shouldEmitLog(minLevel: OtelTraceLevel, severity: LogSeverity): boolean {
  if (minLevel === "off") return severity === "error" || severity === "fatal";
  const minIdx = SEVERITY_ORDER.indexOf(minLevel);
  const sevIdx = SEVERITY_ORDER.indexOf(severity);
  return sevIdx >= minIdx;
}
