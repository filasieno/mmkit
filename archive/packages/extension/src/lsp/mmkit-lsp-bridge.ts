import {
  MMKIT_LSP_METHODS,
  type MmkitServerPhase,
  type MmkitServerStartParams,
  type MmkitServerStateNotification,
} from "@mmkit/shared";
import type { LanguageClient } from "vscode-languageclient/node";
import { toConfigSnapshotPayload } from "../config/snapshot-payload";
import type { ConfigSnapshot } from "../types";

export type MmkitServerStateListener = (notification: MmkitServerStateNotification) => void;

const PHASE_TO_PANEL_STATE: Record<MmkitServerPhase, string> = {
  idle: "Idle",
  starting: "Starting",
  installing: "Installing",
  running: "Running",
  stopping: "Stopping",
  fault: "Fault",
};

export function panelStateFromPhase(phase: MmkitServerPhase): string {
  return PHASE_TO_PANEL_STATE[phase] ?? "Unknown";
}

export function registerMmkitLspBridge(
  client: LanguageClient,
  onServerState: MmkitServerStateListener
): void {
  client.onNotification(MMKIT_LSP_METHODS.serverStateNotification, (notification: MmkitServerStateNotification) => {
    onServerState(notification);
  });
}

export async function sendConfigUpdate(client: LanguageClient, snapshot: ConfigSnapshot): Promise<void> {
  await client.sendRequest(MMKIT_LSP_METHODS.configUpdate, {
    snapshot: toConfigSnapshotPayload(snapshot),
  });
}

export async function sendServerStart(client: LanguageClient, snapshot: ConfigSnapshot): Promise<void> {
  const params: MmkitServerStartParams = {
    generation: snapshot.generation,
    snapshot: toConfigSnapshotPayload(snapshot),
  };
  await client.sendRequest(MMKIT_LSP_METHODS.serverStart, params);
}

export async function sendServerStop(client: LanguageClient): Promise<void> {
  await client.sendRequest(MMKIT_LSP_METHODS.serverStop, {});
}
