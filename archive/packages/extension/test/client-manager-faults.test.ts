import { expect } from "chai";
import { createClientManager } from "../src/actors/client-manager";
import { FaultRegistry, type FaultMode, type PortMethod } from "./faults/fault-injection";
import { createFaultablePorts } from "./faults/faulty-ports";
import {
  ACTOR_IDS,
  clientSnapshot,
  createTestRegistry,
  installFaultCollector,
  settleHsm,
  traceFor,
  expectFaultReported,
} from "./faults/hsm-fault-helpers";
import { waitForHsmState } from "./helpers/hsm";

interface ClientActuatorCase {
  method: PortMethod;
  mode: FaultMode;
  faultFragment: string;
}

function createClient(registry: ReturnType<typeof createTestRegistry>, ports: ReturnType<typeof createFaultablePorts>["ports"]) {
  return createClientManager({
    ports,
    registry,
    trace: traceFor(ACTOR_IDS.client),
    enabled: false,
    clientName: '""',
    serverName: '""',
    shutdownRequested: false,
    disableAfterStop: false,
  });
}

async function startConnect(registry: ReturnType<typeof createTestRegistry>, client: ReturnType<typeof createClientManager>) {
  registry.register(ACTOR_IDS.client, client as never);
  client.post("enable", clientSnapshot(false));
  await client.sync();
  client.post("userConnect");
}

describe("ClientManager actuator fault injection", () => {
  const connectActuators: ClientActuatorCase[] = [
    { method: "tcp.connect", mode: "return-error", faultFragment: "fault:tcp.connect" },
    { method: "tcp.connect", mode: "throw", faultFragment: "fault:tcp.connect" },
    { method: "tcp.enroll", mode: "return-error", faultFragment: "fault:tcp.enroll" },
    { method: "tcp.enroll", mode: "throw", faultFragment: "fault:tcp.enroll" },
  ];

  for (const { method, mode, faultFragment } of connectActuators) {
    it(`${method} ${mode} → Idle without FatalErrorState`, async () => {
      const faults = new FaultRegistry();
      faults.set(method, { mode, message: `fault:${method}` });
      const { ports } = createFaultablePorts(faults);
      const registry = createTestRegistry();
      const getFaults = installFaultCollector(registry);
      const client = createClient(registry, ports);

      await startConnect(registry, client);
      const state = await settleHsm(registry, client);

      expect(state).to.equal("Idle");
      expectFaultReported(getFaults(), faultFragment);
    });
  }

  it("tcp.close throw during enroll failure still reaches Idle", async () => {
    const faults = new FaultRegistry();
    faults.set("tcp.enroll", { mode: "return-error", message: "enroll rejected" });
    faults.set("tcp.close", { mode: "throw", message: "close failed" });
    const { ports } = createFaultablePorts(faults);
    const registry = createTestRegistry();
    const getFaults = installFaultCollector(registry);
    const client = createClient(registry, ports);

    await startConnect(registry, client);
    const state = await settleHsm(registry, client);

    expect(state).to.equal("Idle");
    expectFaultReported(getFaults(), "close failed");
  });

  it("tcp.disconnect return-error during userDisconnect still reaches Idle", async () => {
    const faults = new FaultRegistry();
    const { ports } = createFaultablePorts(faults);
    const registry = createTestRegistry();
    const getFaults = installFaultCollector(registry);
    const client = createClient(registry, ports);

    await startConnect(registry, client);
    await waitForHsmState(registry, client, "Connected");

    faults.set("tcp.disconnect", { mode: "return-error", message: "disconnect nack" });
    client.post("userDisconnect");
    const state = await settleHsm(registry, client);

    expect(state).to.equal("Idle");
    expectFaultReported(getFaults(), "disconnect nack");
  });

  it("tcp.close return-error during enroll failure still reaches Idle", async () => {
    const faults = new FaultRegistry();
    faults.set("tcp.enroll", { mode: "return-error", message: "enroll rejected" });
    faults.set("tcp.close", { mode: "return-error", message: "close failed" });
    const { ports } = createFaultablePorts(faults);
    const registry = createTestRegistry();
    const getFaults = installFaultCollector(registry);
    const client = createClient(registry, ports);

    await startConnect(registry, client);
    const state = await settleHsm(registry, client);

    expect(state).to.equal("Idle");
    expectFaultReported(getFaults(), "enroll rejected");
  });

  it("tcp.disconnect throw during userDisconnect still reaches Idle", async () => {
    const faults = new FaultRegistry();
    const { ports } = createFaultablePorts(faults);
    const registry = createTestRegistry();
    const client = createClient(registry, ports);

    await startConnect(registry, client);
    await waitForHsmState(registry, client, "Connected");

    faults.set("tcp.disconnect", { mode: "throw", message: "disconnect failed" });
    client.post("userDisconnect");
    const state = await settleHsm(registry, client);

    expect(state).to.equal("Idle");
  });
});
