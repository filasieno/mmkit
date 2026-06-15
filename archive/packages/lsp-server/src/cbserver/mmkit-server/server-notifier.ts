import type { MmkitServerPhase, MmkitServerStateNotification } from "@mmkit/shared";

export interface ServerNotifier {
  emitState(notification: MmkitServerStateNotification): void;
  reportInstallProgress(message: string, percent: number): void;
  showInstallProgress(title: string): void;
  hideInstallProgress(): void;
}

export function phaseFromStateName(stateName: string): MmkitServerPhase {
  if (stateName === "Running") return "running";
  if (stateName === "Idle" || stateName === "Disabled") return "idle";
  if (stateName === "Stopping" || stateName === "ShuttingDown") return "stopping";
  if (stateName === "Starting") return "starting";
  if (stateName.startsWith("Installing")) return "installing";
  return "fault";
}
