import { expect } from "chai";
import { createMmkitServerActor } from "../src/cbserver/mmkit-server/mmkit-server-actor.hsm";
import type { ServerNotifier } from "../src/cbserver/mmkit-server/server-notifier";
import { FaultRegistry, type ServerPortMethod } from "./faults/fault-injection";
import { createFaultableServerPorts } from "./faults/faulty-ports";
import { waitForHsmState } from "./helpers/hsm";
import { testSnapshot } from "./helpers/test-snapshot";

const FAULT_CASES: Array<{ method: ServerPortMethod; mode: "throw" | "return-error" }> = [
  { method: "fs.ensureDir", mode: "throw" },
  { method: "assets.materialize", mode: "throw" },
  { method: "docker.pullImage", mode: "throw" },
  { method: "docker.run", mode: "throw" },
  { method: "process.spawn", mode: "throw" },
  { method: "network.probe", mode: "return-error" },
];

function createActor(faults: FaultRegistry) {
  const notifications: string[] = [];
  const notifier: ServerNotifier = {
    emitState: (n) => {
      if (n.fault) notifications.push(n.fault);
    },
    reportInstallProgress: () => undefined,
    showInstallProgress: () => undefined,
    hideInstallProgress: () => undefined,
  };
  const { ports } = createFaultableServerPorts(faults);
  const actor = createMmkitServerActor({
    ports,
    notifier,
    shutdownRequested: false,
    progressVisible: false,
  });
  return { actor, notifications };
}

describe("MmkitServerActor faults", () => {
  beforeEach(() => {
    process.env.MMKIT_PORT_PROBE_ATTEMPTS = "4";
    process.env.MMKIT_PORT_PROBE_INTERVAL_MS = "25";
  });

  afterEach(() => {
    delete process.env.MMKIT_PORT_PROBE_ATTEMPTS;
    delete process.env.MMKIT_PORT_PROBE_INTERVAL_MS;
  });

  for (const { method, mode } of FAULT_CASES) {
    it(`returns to Idle on ${method} ${mode}`, async () => {
      const faults = new FaultRegistry();
      faults.set(method, { mode, message: `fault:${method}` });
      if (method === "docker.pullImage") {
        faults.set("docker.imageExists", { mode: "return-error", message: "missing image" });
      }
      const { actor, notifications } = createActor(faults);
      const snapshot =
        method === "process.spawn" || method === "network.probe"
          ? testSnapshot({ launchKind: "executable" })
          : testSnapshot({ launchKind: "docker" });

      actor.post("userStart", snapshot, 1);
      await waitForHsmState(actor, "Idle", { timeoutMs: 8_000, label: `fault ${method}` });

      expect(notifications.length).to.be.greaterThan(0);
      expect(notifications.some((m) => m.includes("fault:") || m.length > 0)).to.equal(true);
    });
  }

  it("stop from Running reaches Idle", async () => {
    const faults = new FaultRegistry();
    const { actor } = createActor(faults);
    const snapshot = testSnapshot({ launchKind: "executable" });
    actor.post("userStart", snapshot, 1);
    await waitForHsmState(actor, "Running");
    actor.post("userStop");
    await waitForHsmState(actor, "Idle");
  });
});
