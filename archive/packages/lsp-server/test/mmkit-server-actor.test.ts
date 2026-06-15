import { expect } from "chai";
import { FAST_START_THRESHOLD_MS } from "@mmkit/shared";
import { createMmkitServerActor } from "../src/cbserver/mmkit-server/mmkit-server-actor.hsm";
import type { ServerNotifier } from "../src/cbserver/mmkit-server/server-notifier";
import { waitForHsmState } from "./helpers/hsm";
import { testSnapshot } from "./helpers/test-snapshot";
import { createSimPorts } from "./ports/sim-ports";

function createTestActor(sim = createSimPorts()) {
  const notifications: Array<{ message?: string; percent?: number; phase?: string }> = [];
  const notifier: ServerNotifier = {
    emitState: (n) => notifications.push({ phase: n.phase, message: n.message }),
    reportInstallProgress: (message, percent) => notifications.push({ message, percent }),
    showInstallProgress: () => undefined,
    hideInstallProgress: () => undefined,
  };
  const actor = createMmkitServerActor({
    ports: sim.ports,
    notifier,
    shutdownRequested: false,
    progressVisible: false,
  });
  return { actor, sim, notifications };
}

describe("MmkitServerActor", () => {
  it("runs executable install pipeline and reaches Running", async () => {
    const { actor, sim } = createTestActor();
    const snapshot = testSnapshot({ launchKind: "executable" });

    actor.post("userStart", snapshot, 1);
    await waitForHsmState(actor, "Running", { timeoutMs: 8_000 });

    expect(sim.sim.assets.materializeCalls).to.equal(1);
    expect(sim.sim.process.spawnCount).to.be.greaterThan(0);
  });

  it("runs docker install pipeline and reaches Running", async () => {
    const { actor, sim } = createTestActor();
    const snapshot = testSnapshot({ launchKind: "docker" });

    actor.post("userStart", snapshot, 1);
    await waitForHsmState(actor, "Running", { timeoutMs: 8_000 });

    expect(sim.sim.assets.materializeCalls).to.equal(1);
    expect(await sim.sim.docker.isRunning(snapshot.server.dockerContainerName)).to.equal(true);
  });

  it("skips materialize when install marker exists", async () => {
    const sim = createSimPorts();
    const snapshot = testSnapshot();
    sim.sim.assets.installedMarkers.add(snapshot.paths.installMarker);
    const { actor } = createTestActor(sim);

    actor.post("userStart", snapshot, 1);
    await waitForHsmState(actor, "Running", { timeoutMs: 8_000 });

    expect(sim.sim.assets.materializeCalls).to.equal(0);
  });

  it("does not auto-start without userStart", async () => {
    const { actor } = createTestActor();
    await actor.sync();
    expect(actor.currentStateName).to.equal("Idle");
  });

  it("shows slow-start progress after threshold", async function () {
    this.timeout(FAST_START_THRESHOLD_MS + 5_000);
    const sim = createSimPorts();
    sim.sim.process.startupDelayMs = FAST_START_THRESHOLD_MS + 500;
    const snapshot = testSnapshot({ launchKind: "executable" });
    const { actor, notifications } = createTestActor(sim);

    actor.post("userStart", snapshot, 1);
    await waitForHsmState(actor, "Running", { timeoutMs: FAST_START_THRESHOLD_MS + 4_000 });

    expect(notifications.some((n) => n.percent !== undefined && n.percent > 0)).to.equal(true);
  });
});
