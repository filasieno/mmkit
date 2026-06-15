import { TraceLevel } from "ihsm";
import type { ActorOptions } from "ihsm";

/** Spawn options for ihsm actors — quiet in tests unless `MMKIT_IHSM_TRACE=1`. */
export class CbActorSpawnOptions implements ActorOptions {
  readonly initialize: boolean;
  readonly traceLevel: TraceLevel;

  constructor(options?: { initialize?: boolean }) {
    const verbose: boolean = process.env.MMKIT_IHSM_TRACE === "1";
    this.initialize = options?.initialize ?? true;
    this.traceLevel = verbose ? TraceLevel.VERBOSE_DEBUG : TraceLevel.PRODUCTION;
  }
}

/** @deprecated Use {@link CbActorSpawnOptions} */
export function cbActorSpawnOptions(overrides?: { initialize?: boolean }): CbActorSpawnOptions {
  return new CbActorSpawnOptions(overrides);
}
