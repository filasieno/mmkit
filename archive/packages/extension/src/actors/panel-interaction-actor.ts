import * as ihsm from "ihsm";
import { buildPanelViewModel } from "../panel/view-model";
import { makeMmkitHsm } from "../logging/hsm-factory";
import type { MmkitTraceWriter } from "../logging/trace";
import type { ActorRegistry } from "../registry";
import { ACTOR_IDS } from "../registry";
import type { MmkitPorts } from "../ports/types";
import type { ConfigSnapshot, OtelTraceLevel, PanelInteraction, PanelViewModel } from "../types";
export interface PanelInteractionCtx {
  ports: MmkitPorts;
  registry: ActorRegistry;
  trace: MmkitTraceWriter;
  snapshot?: ConfigSnapshot;
  serverState?: string;
  clientState?: string;
  traceLevel: OtelTraceLevel;
  shutdownRequested: boolean;
  interactionUnsubscribe?: () => void;
}

export interface PanelInteractionProtocol {
  enable(snapshot: ConfigSnapshot, serverState?: string, clientState?: string): void;
  disable(): void;
  snapshotUpdated(snapshot: ConfigSnapshot): void;
  managerStateUpdated(serverState?: string, clientState?: string): void;
  traceLevelChanged(level: OtelTraceLevel): void;
  hostInteraction(interaction: PanelInteraction): void;
  shutdownRequested(): void;
  shutdownForce(): void;
  renderViewModel(): void;
  subscribeHost(): void;
}

export class PanelTop extends ihsm.TopState<PanelInteractionCtx, PanelInteractionProtocol> {
  traceLevelChanged(level: OtelTraceLevel): void {
    this.ctx.traceLevel = level;
    this.ctx.trace.info("trace level changed", { level, state: this.hsm.currentStateName });
  }

  protected debug(message: string, detail?: unknown): void {
    this.ctx.trace.debug(this.hsm, message, detail);
  }

  protected async pushViewModel(): Promise<void> {
    const vm = buildPanelViewModel({
      snapshot: this.ctx.snapshot,
      serverState: this.ctx.serverState,
      clientState: this.ctx.clientState,
      traceLevel: this.ctx.traceLevel,
    });
    try {
      await this.ctx.ports.panel.render(vm);
    } catch (err) {
      this.ctx.trace.error("panel render failed", { error: String(err) });
      this.ctx.registry.postFrom(ACTOR_IDS.panel, ACTOR_IDS.supervisor, "managerReportFault", {
        actorId: ACTOR_IDS.panel,
        message: `panel render failed: ${String(err)}`,
      });
    }
  }
}

@ihsm.InitialState
export class Disabled extends PanelTop {
  onEntry(): void {
    this.ctx.interactionUnsubscribe?.();
    this.ctx.interactionUnsubscribe = undefined;
  }

  enable(snapshot: ConfigSnapshot, serverState?: string, clientState?: string): void {
    this.ctx.snapshot = snapshot;
    this.ctx.serverState = serverState;
    this.ctx.clientState = clientState;
    this.ctx.traceLevel = snapshot.traceLevel;
    this.transition(Active);
  }

  shutdownRequested(): void {
    this.transition(ShuttingDown);
  }

  shutdownForce(): void {
    this.transition(ShuttingDown);
  }
}

export class Active extends PanelTop {
  onEntry(): void {
    this.postNow("subscribeHost");
    this.postNow("renderViewModel");
  }

  onExit(): void {
    this.ctx.interactionUnsubscribe?.();
    this.ctx.interactionUnsubscribe = undefined;
  }

  subscribeHost(): void {
    this.ctx.interactionUnsubscribe?.();
    this.ctx.interactionUnsubscribe = this.ctx.ports.panel.onInteraction((interaction) => {
      this.post("hostInteraction", interaction);
    });
  }

  async renderViewModel(): Promise<void> {
    await this.pushViewModel();
  }

  disable(): void {
    this.transition(Disabled);
  }

  /** Idempotent re-enable when operational mode is reapplied after config reload. */
  enable(snapshot: ConfigSnapshot, serverState?: string, clientState?: string): void {
    this.snapshotUpdated(snapshot);
    this.managerStateUpdated(serverState, clientState);
  }

  snapshotUpdated(snapshot: ConfigSnapshot): void {
    this.ctx.snapshot = snapshot;
    this.ctx.traceLevel = snapshot.traceLevel;
    this.postNow("renderViewModel");
  }

  managerStateUpdated(serverState?: string, clientState?: string): void {
    if (serverState !== undefined) this.ctx.serverState = serverState;
    if (clientState !== undefined) this.ctx.clientState = clientState;
    this.postNow("renderViewModel");
  }

  traceLevelChanged(level: OtelTraceLevel): void {
    super.traceLevelChanged(level);
    this.postNow("renderViewModel");
  }

  hostInteraction(interaction: PanelInteraction): void {
    this.debug("panel interaction", interaction);
    this.ctx.registry.postFrom(ACTOR_IDS.panel, ACTOR_IDS.supervisor, "panelInteraction", interaction);
  }

  shutdownRequested(): void {
    this.ctx.shutdownRequested = true;
    this.transition(ShuttingDown);
  }
}

export class ShuttingDown extends PanelTop {
  onEntry(): void {
    this.ctx.interactionUnsubscribe?.();
    this.ctx.interactionUnsubscribe = undefined;
    this.ctx.registry.postFrom(ACTOR_IDS.panel, ACTOR_IDS.supervisor, "childShutdownAck", ACTOR_IDS.panel);
  }

  shutdownRequested(): void {}

  shutdownForce(): void {}
}

ihsm.registerStateNames({
  Disabled,
  Active,
  ShuttingDown,
});

export function createPanelInteractionActor(
  ctx: PanelInteractionCtx
): ihsm.Hsm<PanelInteractionCtx, PanelInteractionProtocol> {
  return makeMmkitHsm(PanelTop, ctx);
}

export type { PanelViewModel };
