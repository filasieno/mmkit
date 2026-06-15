import { pollUntil, type PollUntilOptions } from "./async";

interface SyncableHsm {
  sync(): Promise<void>;
  currentStateName: string;
}

export async function waitForHsmState(
  hsm: SyncableHsm,
  target: string,
  options: PollUntilOptions = {}
): Promise<void> {
  await pollUntil(
    async () => {
      await hsm.sync();
      return hsm.currentStateName === target;
    },
    { ...options, label: options.label ?? `HSM state ${target}` }
  );
}
