import { expect } from "chai";
import { createExtensionSupervisor } from "../src/actors/extension-supervisor";
import { DEFAULT_RAW } from "../src/config/schema";
import { MmkitTraceWriter } from "../src/logging/trace";
import { createSimPorts } from "../src/ports/sim/sim-ports";
import { ACTOR_IDS, ActorRegistry } from "../src/registry";
import { waitForActorState, waitForHsmState } from "./helpers/hsm";

const mockContext = {
  subscriptions: { push: () => ({ dispose: () => undefined }) },
  extensionMode: 3,
} as unknown as import("vscode").ExtensionContext;

async function bootstrapActive(
  registry: ActorRegistry,
  ports: ReturnType<typeof createSimPorts>
): Promise<ReturnType<typeof createExtensionSupervisor>> {
  const supervisor = createExtensionSupervisor({
    ports,
    registry,
    trace: new MmkitTraceWriter(ACTOR_IDS.supervisor),
    disposables: [],
    mode: "none",
  });
  registry.register(ACTOR_IDS.supervisor, supervisor as never);
  supervisor.post("hostActivated", mockContext);
  await waitForHsmState(registry, supervisor, "Active");
  return supervisor;
}

describe("ExtensionSupervisor", () => {
  it("bootstraps actors and reaches Active after hostActivated", async () => {
    const registry = new ActorRegistry();
    const ports = createSimPorts();
    await bootstrapActive(registry, ports);

    expect(registry.get(ACTOR_IDS.config)).to.exist;
    expect(registry.get(ACTOR_IDS.client)).to.exist;
    expect(registry.get(ACTOR_IDS.languageServer)).to.exist;
    expect(registry.get(ACTOR_IDS.panel)).to.exist;
    expect(registry.get(ACTOR_IDS.server)).to.not.exist;
  });

  it("shuts down to Inactive on hostDeactivating", async () => {
    const registry = new ActorRegistry();
    const ports = createSimPorts();
    const supervisor = await bootstrapActive(registry, ports);

    supervisor.post("hostDeactivating");
    await waitForHsmState(registry, supervisor, "Inactive", 10_000);

    expect(registry.ids()).to.have.length(0);
  });

  it("switches from internalServer to client via SwitchingMode", async function () {
    this.timeout(10_000);
    const registry = new ActorRegistry();
    const ports = createSimPorts();
    ports.sim.config.setSettings({
      ...DEFAULT_RAW,
      operationalMode: "internalServer",
      server: { ...DEFAULT_RAW.server, autoStartup: false },
      client: { ...DEFAULT_RAW.client, autoConnect: false },
    });

    const supervisor = await bootstrapActive(registry, ports);
    expect(supervisor.ctx.mode).to.equal("internalServer");

    supervisor.post("hostSettingsPatch", {
      operationalMode: "client",
    } satisfies Partial<typeof DEFAULT_RAW>);
    await waitForHsmState(registry, supervisor, "Active", 8000);

    expect(supervisor.ctx.mode).to.equal("client");
    await waitForActorState(registry, registry.get(ACTOR_IDS.client), "Idle");
  });

  it("finishes shutdown on watchdog when children stall", async () => {
    const registry = new ActorRegistry();
    const ports = createSimPorts();
    const supervisor = await bootstrapActive(registry, ports);

    supervisor.post("hostDeactivating");
    supervisor.post("shutdownWatchdogExpired");
    await waitForHsmState(registry, supervisor, "Inactive");

    expect(registry.ids()).to.have.length(0);
  });
});
