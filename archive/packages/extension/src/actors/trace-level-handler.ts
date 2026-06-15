import type { ActorRegistry } from "../registry";
import type { OtelTraceLevel } from "../types";
import type { MmkitTraceWriter } from "../logging/trace";

/** Shared top-state handler: fan-out OTEL trace level to registry + ihsm actors. */
export function applyTraceLevelChange(
  registry: ActorRegistry,
  trace: MmkitTraceWriter,
  hsm: { currentStateName: string },
  level: OtelTraceLevel
): void {
  registry.applyTraceLevel(level);
  trace.info("trace level changed", { level, state: hsm.currentStateName });
}
