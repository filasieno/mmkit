import type { InstallStep } from "../constants";

/** Percent range [start, end) for each install pipeline phase (0–100 scale). */
export const INSTALL_PROGRESS_RANGES: Record<InstallStep, { start: number; end: number }> = {
  prepare: { start: 0, end: 15 },
  materialize: { start: 15, end: 40 },
  dockerImage: { start: 40, end: 65 },
  launch: { start: 65, end: 80 },
  awaitPort: { start: 80, end: 99 },
};

export function percentWithinStep(step: InstallStep, fraction: number): number {
  const { start, end } = INSTALL_PROGRESS_RANGES[step];
  const clamped = Math.min(1, Math.max(0, fraction));
  return Math.round(start + (end - start) * clamped);
}

export type InstallProgressCallback = (message: string, fractionWithinStep: number) => void;
