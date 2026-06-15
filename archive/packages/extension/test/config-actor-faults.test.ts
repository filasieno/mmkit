import { expect } from "chai";
import { createConfigActor } from "../src/actors/config-actor";
import { FaultRegistry, type PortMethod } from "./faults/fault-injection";
import { createFaultablePorts } from "./faults/faulty-ports";
import { ACTOR_IDS, createTestRegistry, traceFor } from "./faults/hsm-fault-helpers";
import { waitForHsmState } from "./helpers/hsm";

function createConfig(registry: ReturnType<typeof createTestRegistry>, ports: ReturnType<typeof createFaultablePorts>["ports"]) {
  return createConfigActor({
    ports,
    registry,
    trace: traceFor(ACTOR_IDS.config),
    generation: 0,
    validationErrors: [],
    shutdownRequested: false,
  });
}

describe("ConfigActor sensor/actuator fault injection", () => {
  const cases: Array<{ method: PortMethod; mode: "throw" | "return-error"; label: string }> = [
    { method: "vscodeConfig.readConfiguration", mode: "throw", label: "read sensor throw" },
    { method: "vscodeConfig.readConfiguration", mode: "return-error", label: "read sensor return-error" },
    { method: "fs.ensureDir", mode: "throw", label: "ensureDir actuator throw" },
    { method: "fs.ensureDir", mode: "return-error", label: "ensureDir actuator return-error" },
  ];

  for (const { method, mode, label } of cases) {
    it(`${label} → Ready without FatalErrorState`, async () => {
      const faults = new FaultRegistry();
      faults.set(method, { mode, message: `fault:${method}` });
      const { ports } = createFaultablePorts(faults);
      const registry = createTestRegistry();
      const config = createConfig(registry, ports);
      registry.register(ACTOR_IDS.config, config as never);

      if (method === "fs.ensureDir") {
        config.post("reloadFromHost");
        await waitForHsmState(registry, config, "Ready");
        faults.set(method, { mode, message: `fault:${method}` });
        config.post("settingsPatch", { operationalMode: "client" });
      } else {
        config.post("reloadFromHost");
      }

      await config.sync();
      await registry.syncAll();

      expect(config.currentStateName).to.equal("Ready");
      expect(config.currentStateName).to.not.equal("FatalErrorState");
    });
  }
});
