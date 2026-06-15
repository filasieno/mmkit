import { expect } from "chai";
import { buildSnapshot } from "../src/config/snapshot";
import { DEFAULT_RAW } from "../src/config/schema";
import { createPanelInteractionActor } from "../src/actors/panel-interaction-actor";
import { FaultRegistry } from "./faults/fault-injection";
import { createFaultablePorts } from "./faults/faulty-ports";
import { ACTOR_IDS, createTestRegistry, installFaultCollector, traceFor } from "./faults/hsm-fault-helpers";
import { waitForHsmState } from "./helpers/hsm";

describe("PanelInteractionActor fault injection", () => {
  it("panel.render throw → stays Active and reports fault", async () => {
    const faults = new FaultRegistry();
    faults.set("panel.render", { mode: "throw", message: "fault:panel.render" });
    const { ports } = createFaultablePorts(faults);
    const registry = createTestRegistry();
    const getFaults = installFaultCollector(registry);
    const panel = createPanelInteractionActor({
      ports,
      registry,
      trace: traceFor(ACTOR_IDS.panel),
      traceLevel: "info",
      shutdownRequested: false,
    });
    registry.register(ACTOR_IDS.panel, panel as never);
    registry.register(ACTOR_IDS.supervisor, {
      post: () => undefined,
      sync: async () => undefined,
      currentStateName: "Active",
    } as never);

    panel.post("enable", buildSnapshot(DEFAULT_RAW, 1));
    await waitForHsmState(registry, panel, "Active");
    expect(panel.currentStateName).to.not.equal("FatalErrorState");
    expect(getFaults().some((m) => m.includes("fault:panel.render"))).to.equal(true);
  });

  it("panel.render return-error → stays Active (noop void success)", async () => {
    const faults = new FaultRegistry();
    faults.set("panel.render", { mode: "return-error", message: "render nack" });
    const { ports, sim } = createFaultablePorts(faults);
    const registry = createTestRegistry();
    const panel = createPanelInteractionActor({
      ports,
      registry,
      trace: traceFor(ACTOR_IDS.panel),
      traceLevel: "info",
      shutdownRequested: false,
    });
    registry.register(ACTOR_IDS.panel, panel as never);
    panel.post("enable", buildSnapshot(DEFAULT_RAW, 1));
    await waitForHsmState(registry, panel, "Active");
    expect(panel.currentStateName).to.equal("Active");
    expect(sim.panel.lastViewModel).to.exist;
  });
});
