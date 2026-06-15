import type { ActorRegistry } from "../../src/registry";
import { pollUntil, type PollUntilOptions } from "./async";

interface SyncableHsm {
  sync(): Promise<void>;
  currentStateName: string;
}

export async function waitForHsmState(
  registry: ActorRegistry,
  hsm: SyncableHsm,
  target: string,
  timeoutMs?: number
): Promise<void> {
  const options: PollUntilOptions = {
    timeoutMs,
    label: `HSM state ${target}`,
  };
  await pollUntil(
    async () => {
      await hsm.sync();
      await registry.syncAll();
      return hsm.currentStateName === target;
    },
    options
  );
}

export async function waitForActorState(
  registry: ActorRegistry,
  hsm: SyncableHsm | undefined,
  target: string,
  timeoutMs?: number
): Promise<void> {
  if (!hsm) {
    throw new Error(`waitForActorState: actor not registered (expected ${target})`);
  }
  await waitForHsmState(registry, hsm, target, timeoutMs);
}
