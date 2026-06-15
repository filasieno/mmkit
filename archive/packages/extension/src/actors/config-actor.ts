import * as ihsm from "ihsm";
import { buildSnapshot, requiredDataDirectories } from "../config/snapshot";
import { makeMmkitHsm } from "../logging/hsm-factory";
import type { MmkitTraceWriter } from "../logging/trace";
import type { ActorRegistry } from "../registry";
import { ACTOR_IDS } from "../registry";
import type { MmkitPorts } from "../ports/types";
import type { ConfigSnapshot, OtelTraceLevel, RawMmkitSettings, ValidationError } from "../types";

export interface ConfigActorCtx {
  ports: MmkitPorts;
  registry: ActorRegistry;
  trace: MmkitTraceWriter;
  raw?: RawMmkitSettings;
  snapshot?: ConfigSnapshot;
  generation: number;
  validationErrors: ValidationError[];
  shutdownRequested: boolean;
  /** When true, Loading skips re-reading workspace configuration (in-memory settingsPatch). */
  skipHostRead?: boolean;
}

export interface ConfigActorProtocol {
  reloadFromHost(resource?: unknown): void;
  settingsPatch(patch: Partial<RawMmkitSettings>): void;
  shutdownRequested(): void;
  shutdownForce(): void;
  readAndMerge(): void;
  resolveServerPaths(): void;
  validateSnapshot(): void;
  publishOrInvalidate(): void;
  traceLevelChanged(level: OtelTraceLevel): void;
}

export class ConfigTop extends ihsm.TopState<ConfigActorCtx, ConfigActorProtocol> {
  traceLevelChanged(level: OtelTraceLevel): void {
    this.ctx.trace.info("trace level changed", { level, state: this.hsm.currentStateName });
  }

  publish(snapshot: ConfigSnapshot, errors: ValidationError[]): void {
    this.ctx.trace.info("snapshot published", {
      generation: snapshot.generation,
      valid: snapshot.valid,
      mode: snapshot.operationalMode,
      errors: errors.length,
    });
    this.registry.postFrom(ACTOR_IDS.config, ACTOR_IDS.supervisor, "snapshotPublished", snapshot);
    if (!snapshot.valid) {
      this.ctx.trace.warn("snapshot invalid", { errors });
      this.registry.postFrom(ACTOR_IDS.config, ACTOR_IDS.supervisor, "snapshotInvalid", errors);
    }
  }

  protected get registry(): ActorRegistry {
    return this.ctx.registry;
  }

  reloadFromHost(): void {
    this.transition(Loading);
  }

  shutdownRequested(): void {
    this.ctx.shutdownRequested = true;
    this.transition(ShuttingDown);
  }

  shutdownForce(): void {
    this.transition(ShuttingDown);
  }
}

@ihsm.InitialState
export class Inactive extends ConfigTop {}

export class Loading extends ConfigTop {
  onEntry(): void {
    this.postNow("readAndMerge");
  }

  readAndMerge(): void {
    try {
      if (!this.ctx.skipHostRead) {
        this.ctx.raw = this.ctx.ports.vscodeConfig.readConfiguration();
      }
      this.ctx.skipHostRead = false;
      this.postNow("resolveServerPaths");
    } catch (err) {
      this.ctx.trace.error("readConfiguration failed", { error: String(err) });
      this.transition(Ready);
    }
  }

  async resolveServerPaths(): Promise<void> {
    if (!this.ctx.raw) return;
    try {
      const snapshot = buildSnapshot(this.ctx.raw, this.ctx.generation);
      for (const dir of requiredDataDirectories(snapshot.paths)) {
        await this.ctx.ports.fs.ensureDir(dir);
      }
      this.postNow("validateSnapshot");
    } catch (err) {
      this.ctx.trace.error("resolveServerPaths failed", { error: String(err) });
      this.transition(Ready);
    }
  }

  validateSnapshot(): void {
    if (!this.ctx.raw) return;
    this.ctx.generation += 1;
    this.ctx.snapshot = buildSnapshot(this.ctx.raw, this.ctx.generation);
    this.ctx.validationErrors = this.ctx.snapshot.errors;
    this.postNow("publishOrInvalidate");
  }

  publishOrInvalidate(): void {
    if (!this.ctx.snapshot) return;
    this.publish(this.ctx.snapshot, this.ctx.validationErrors);
    if (this.ctx.shutdownRequested) {
      this.transition(ShuttingDown);
      return;
    }
    this.transition(Ready);
  }
}

export class Ready extends ConfigTop {
  settingsPatch(patch: Partial<RawMmkitSettings>): void {
    if (!this.ctx.raw) return;
    this.ctx.raw = {
      ...this.ctx.raw,
      ...patch,
      traceLevel: patch.traceLevel ?? this.ctx.raw.traceLevel,
      server: { ...this.ctx.raw.server, ...patch.server },
      client: { ...this.ctx.raw.client, ...patch.client },
    };
    this.ctx.skipHostRead = true;
    this.transition(Loading);
  }
}

export class ShuttingDown extends ConfigTop {
  onEntry(): void {
    this.registry.postFrom(ACTOR_IDS.config, ACTOR_IDS.supervisor, "childShutdownAck", ACTOR_IDS.config);
  }

  shutdownRequested(): void {
    // Already shutting down.
  }

  shutdownForce(): void {
    // Already shutting down.
  }
}

ihsm.registerStateNames({
  Inactive,
  Loading,
  Ready,
  ShuttingDown,
});

export function createConfigActor(ctx: ConfigActorCtx): ihsm.Hsm<ConfigActorCtx, ConfigActorProtocol> {
  return makeMmkitHsm(ConfigTop, ctx);
}
