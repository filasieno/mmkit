import { expect } from "chai";
import { buildSnapshot } from "../src/config/snapshot";
import { DEFAULT_RAW } from "../src/config/schema";
import { createPanelInteractionActor } from "../src/actors/panel-interaction-actor";
import { createExtensionSupervisor } from "../src/actors/extension-supervisor";
import { createSimPorts } from "../src/ports/sim/sim-ports";
import { ACTOR_IDS, ActorRegistry } from "../src/registry";
import { MmkitTraceWriter } from "../src/logging/trace";
import { waitForHsmState } from "./helpers/hsm";
import { buildPanelViewModel } from "../src/panel/view-model";

describe("PanelInteractionActor", () => {
  it("renders view model on enable", async () => {
    const registry = new ActorRegistry();
    const ports = createSimPorts();
    const snapshot = buildSnapshot(DEFAULT_RAW, 1);
    const panel = createPanelInteractionActor({
      ports,
      registry,
      trace: new MmkitTraceWriter(ACTOR_IDS.panel),
      traceLevel: "info",
      shutdownRequested: false,
    });
    registry.register(ACTOR_IDS.panel, panel as never);

    panel.post("enable", snapshot, "Idle", "Disabled");
    await panel.sync();

    expect(panel.currentStateName).to.equal("Active");
    expect(ports.sim.panel.lastViewModel?.operationalMode).to.equal("internalServer");
    expect(ports.sim.panel.lastViewModel?.actions.some((a) => a.id === "startServer")).to.equal(true);
  });

  it("forwards click interaction to supervisor hostCommand path", async () => {
    const registry = new ActorRegistry();
    const ports = createSimPorts();
    const snapshot = buildSnapshot({ ...DEFAULT_RAW, server: { ...DEFAULT_RAW.server, autoStartup: false } }, 1);
    let posted = "";
    const supervisor = createExtensionSupervisor({
      ports,
      registry,
      trace: new MmkitTraceWriter(ACTOR_IDS.supervisor),
      disposables: [],
      mode: "internalServer",
      snapshot,
    });
    registry.register(ACTOR_IDS.supervisor, supervisor as never);
    const panel = createPanelInteractionActor({
      ports,
      registry,
      trace: new MmkitTraceWriter(ACTOR_IDS.panel),
      traceLevel: "info",
      shutdownRequested: false,
    });
    registry.register(ACTOR_IDS.panel, panel as never);
    const originalPost = registry.postFrom.bind(registry);
    registry.postFrom = (from, to, event, ...args) => {
      if (from === ACTOR_IDS.panel && event === "panelInteraction") posted = (args[0] as { actionId: string }).actionId;
      return originalPost(from, to, event, ...args);
    };

    panel.post("enable", snapshot, "Idle", "Disabled");
    await panel.sync();
    ports.sim.panel.simulateInteraction({ kind: "click", actionId: "startServer" });
    await registry.syncAll();
    expect(posted).to.equal("startServer");
  });

  it("traceLevelChanged updates rendered view model", async () => {
    const registry = new ActorRegistry();
    const ports = createSimPorts();
    const snapshot = buildSnapshot(DEFAULT_RAW, 1);
    const panel = createPanelInteractionActor({
      ports,
      registry,
      trace: new MmkitTraceWriter(ACTOR_IDS.panel),
      traceLevel: "info",
      shutdownRequested: false,
    });
    registry.register(ACTOR_IDS.panel, panel as never);
    panel.post("enable", snapshot);
    await panel.sync();
    panel.post("traceLevelChanged", "debug");
    await panel.sync();
    expect(ports.sim.panel.lastViewModel?.traceLevel).to.equal("debug");
  });
});

describe("buildPanelViewModel", () => {
  it("enables start when internal server idle and valid", () => {
    const vm = buildPanelViewModel({
      snapshot: buildSnapshot(DEFAULT_RAW, 1),
      serverState: "Idle",
      clientState: "Disabled",
      traceLevel: "info",
    });
    const start = vm.actions.find((a) => a.id === "startServer");
    expect(start?.enabled).to.equal(true);
  });
});
