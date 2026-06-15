import { expect } from "chai";
import { createExtensionSupervisor } from "../src/actors/extension-supervisor";
import { FaultRegistry } from "./faults/fault-injection";
import { createFaultablePorts } from "./faults/faulty-ports";
import { ACTOR_IDS, traceFor } from "./faults/hsm-fault-helpers";
import { ActorRegistry } from "../src/registry";
import { waitForActorState, waitForHsmState } from "./helpers/hsm";

const mockContext = {
  subscriptions: { push: () => ({ dispose: () => undefined }) },
  extensionMode: 3,
} as unknown as import("vscode").ExtensionContext;

describe("ExtensionSupervisor with child actuator faults", () => {
  it("hostCommand connect survives tcp.connect return-error on client manager", async () => {
    const faults = new FaultRegistry();
    faults.set("tcp.connect", { mode: "return-error", message: "connect refused" });
    const { ports, sim } = createFaultablePorts(faults);
    sim.config.setSettings({
      ...sim.config.readConfiguration(),
      operationalMode: "client",
      server: { ...sim.config.readConfiguration().server, autoStartup: false },
      client: { ...sim.config.readConfiguration().client, autoConnect: false },
    });

    const registry = new ActorRegistry();
    const supervisor = createExtensionSupervisor({
      ports,
      registry,
      trace: traceFor(ACTOR_IDS.supervisor),
      disposables: [],
      mode: "none",
    });
    registry.register(ACTOR_IDS.supervisor, supervisor as never);

    supervisor.post("hostActivated", mockContext);
    await waitForHsmState(registry, supervisor, "Active");

    supervisor.post("hostCommand", "mmkit.connect");
    await waitForActorState(registry, registry.get(ACTOR_IDS.client), "Idle");

    expect(supervisor.currentStateName).to.equal("Active");
  });

  it("survives language server fault report without FatalErrorState", async () => {
    const registry = new ActorRegistry();
    const { ports } = createFaultablePorts(new FaultRegistry());
    const supervisor = createExtensionSupervisor({
      ports,
      registry,
      trace: traceFor(ACTOR_IDS.supervisor),
      disposables: [],
      mode: "none",
    });
    registry.register(ACTOR_IDS.supervisor, supervisor as never);
    supervisor.post("hostActivated", mockContext);
    await waitForHsmState(registry, supervisor, "Active");

    supervisor.post("managerReportFault", {
      actorId: ACTOR_IDS.languageServer,
      message: "simulated LSP fault",
    });
    await supervisor.sync();

    expect(supervisor.currentStateName).to.equal("Active");
    expect(supervisor.currentStateName).to.not.equal("FatalErrorState");
  });
});
