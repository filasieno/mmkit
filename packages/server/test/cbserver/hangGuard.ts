/**
 * Progress logging for real-cbserver tests.
 *
 * Enabled by default (`MMKIT_TEST_HANG_LOG` unset or `1`). Set `MMKIT_TEST_HANG_LOG=0` to silence.
 * Separate from `MMKIT_CBSERVER_TRACE` (verbose IPC) and `MMKIT_IHSM_TRACE` (HSM transitions).
 */
/// <reference types="node" />

const hangLogEnabled = (): boolean => process.env.MMKIT_TEST_HANG_LOG !== "0";

export function hangLog(step: string, detail?: Record<string, unknown>): void {
  if (!hangLogEnabled()) {
    return;
  }
  const ts = new Date().toISOString();
  if (detail === undefined) {
    console.error(`[hang-guard ${ts}] ${step}`);
    return;
  }
  console.error(`[hang-guard ${ts}] ${step}`, JSON.stringify(detail));
}

/** Active phases (refcounted) — safe under parallel raceTimeout calls. */
const activePhases = new Map<string, number>();

export function currentPhasePath(): string {
  if (activePhases.size === 0) {
    return "(idle)";
  }
  return [...activePhases.entries()]
    .flatMap(([label, count]) => (count > 1 ? [`${label}×${count}`] : [label]))
    .join(" + ");
}

export function pushPhase(label: string): void {
  activePhases.set(label, (activePhases.get(label) ?? 0) + 1);
  hangLog("phase:enter", { label, path: currentPhasePath() });
}

export function popPhase(label: string): void {
  const count = activePhases.get(label) ?? 0;
  if (count <= 1) {
    activePhases.delete(label);
  } else {
    activePhases.set(label, count - 1);
  }
  hangLog("phase:exit", { label, path: currentPhasePath() });
}

export function resetPhases(): void {
  if (activePhases.size > 0) {
    hangLog("phase:reset", { stale: currentPhasePath() });
  }
  activePhases.clear();
}

export type LiveServerSnapshot = {
  state: string;
  pid?: number;
  connections: number;
};

export function formatLiveServersSnapshot(
  servers: ReadonlyArray<{ actor: { hsm: { currentStateName: string } }; ctx: { pid?: number; connections: { size: number } } }>,
): LiveServerSnapshot[] {
  return servers.map((server) => ({
    state: server.actor.hsm.currentStateName,
    pid: server.ctx.pid,
    connections: server.ctx.connections.size,
  }));
}
