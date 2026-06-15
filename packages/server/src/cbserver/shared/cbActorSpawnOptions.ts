import { TraceLevel } from "ihsm";

/** Spawn options for ihsm actors — quiet in tests unless `MMKIT_IHSM_TRACE=1`. */
export function cbActorSpawnOptions(overrides?: { initialize?: boolean }): {
  initialize: boolean;
  traceLevel: TraceLevel;
} {
  const verbose = process.env.MMKIT_IHSM_TRACE === "1";
  return {
    initialize: overrides?.initialize ?? true,
    traceLevel: verbose ? TraceLevel.VERBOSE_DEBUG : TraceLevel.PRODUCTION,
  };
}
