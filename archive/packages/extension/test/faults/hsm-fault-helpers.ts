import { expect } from "chai";
import { DEFAULT_RAW } from "../../src/config/schema";
import { buildSnapshot } from "../../src/config/snapshot";
import type { ConfigSnapshot } from "../../src/types";
import { ACTOR_IDS, ActorRegistry } from "../../src/registry";
import { MmkitTraceWriter } from "../../src/logging/trace";
import { assertNotFatal } from "./fault-injection";
import { pollUntil } from "../helpers/async";
import { waitForHsmState } from "../helpers/hsm";

export function createTestRegistry(): ActorRegistry {
  return new ActorRegistry();
}

export function serverSnapshot(autoStartup = false): ConfigSnapshot {
  return buildSnapshot(
    {
      ...DEFAULT_RAW,
      server: { ...DEFAULT_RAW.server, autoStartup },
    },
    1
  );
}

export function clientSnapshot(autoConnect = false): ConfigSnapshot {
  return buildSnapshot(
    {
      ...DEFAULT_RAW,
      operationalMode: "client",
      client: { ...DEFAULT_RAW.client, autoConnect },
    },
    1
  );
}

export function traceFor(actorId: string): MmkitTraceWriter {
  return new MmkitTraceWriter(actorId);
}

export function installFaultCollector(registry: ActorRegistry): () => string[] {
  const messages: string[] = [];
  const original = registry.postFrom.bind(registry);
  registry.postFrom = (from, to, event, ...args) => {
    if (event === "managerReportFault") {
      const report = args[0] as { message?: string };
      if (report?.message) messages.push(report.message);
    }
    return original(from, to, event, ...args);
  };
  return () => messages;
}

export async function settleHsm(
  registry: ActorRegistry,
  hsm: { sync(): Promise<void>; currentStateName: string },
  timeoutMs = 8000
): Promise<string> {
  let settled = hsm.currentStateName;
  await pollUntil(
    async () => {
      await hsm.sync();
      await registry.syncAll();
      const state = hsm.currentStateName;
      if (
        state !== "Starting" &&
        !state.startsWith("Installing") &&
        state !== "Connecting" &&
        state !== "Disconnecting" &&
        state !== "Stopping" &&
        state !== "Loading"
      ) {
        assertNotFatal(state);
        settled = state;
        return true;
      }
      return false;
    },
    { timeoutMs, label: `settleHsm (last=${hsm.currentStateName})` }
  );
  return settled;
}

export function expectFaultReported(faults: string[], fragment: string): void {
  expect(faults.some((m) => m.includes(fragment)), `expected fault containing "${fragment}", got: ${faults.join("; ")}`).to.equal(
    true
  );
}

export async function waitForSupervisorIdle(registry: ActorRegistry, supervisor: { sync(): Promise<void>; currentStateName: string }) {
  await waitForHsmState(registry, supervisor, "Active", 5000);
}

export { ACTOR_IDS };
