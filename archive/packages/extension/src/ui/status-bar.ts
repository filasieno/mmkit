import type * as vscode from "vscode";
import type { ConfigSnapshot, OperationalMode } from "../types";

export interface StatusBarActorStates {
  mode: OperationalMode;
  server?: string;
  client?: string;
  languageServer?: string;
  supervisor?: string;
}

export interface StatusBarController {
  showImmediately(): void;
  update(states: StatusBarActorStates, snapshot?: ConfigSnapshot): void;
  dispose(): void;
}

function stateGlyph(state: string | undefined): string {
  if (!state || state === "Disabled" || state === "Inactive") {
    return "$(circle-slash)";
  }
  if (state === "Running" || state === "Connected") {
    return "$(pass-filled)";
  }
  if (
    state === "Starting" ||
    state === "Connecting" ||
    state === "Restarting" ||
    state === "Stopping" ||
    state === "Bootstrapping" ||
    state === "ShuttingDown" ||
    state.startsWith("Installing")
  ) {
    return "$(sync~spin)";
  }
  if (state === "Idle") {
    return "$(circle-outline)";
  }
  return "$(warning)";
}

function operationalLabel(mode: OperationalMode): "mmkit server" | "CB client" {
  return mode === "client" ? "CB client" : "mmkit server";
}

function operationalState(states: StatusBarActorStates): string | undefined {
  if (states.mode === "client") return states.client;
  if (states.mode === "internalServer") return states.server;
  return states.supervisor ?? states.server;
}

function operationalTooltip(
  states: StatusBarActorStates,
  snapshot: ConfigSnapshot | undefined,
  label: string
): string {
  const state = operationalState(states) ?? "unknown";
  if (!snapshot) {
    return `mmkit ${label} — ${state}`;
  }
  if (states.mode === "client") {
    return `${snapshot.client.host}:${snapshot.client.port} — ${state}`;
  }
  return `mmkit server :${snapshot.server.port} — ${state}`;
}

function languageServerTooltip(states: StatusBarActorStates): string {
  const state = states.languageServer ?? "unknown";
  return `ConceptBase LSP — ${state}`;
}

export function createStatusBar(vscodeApi: typeof vscode): StatusBarController {
  const operationalItem = vscodeApi.window.createStatusBarItem(vscodeApi.StatusBarAlignment.Right, 101);
  operationalItem.command = "mmkit.openSettings";

  const lspItem = vscodeApi.window.createStatusBarItem(vscodeApi.StatusBarAlignment.Right, 100);
  lspItem.command = "mmkit.restartLanguageServer";

  return {
    showImmediately() {
      operationalItem.text = "$(sync~spin) mmkit server";
      operationalItem.tooltip = "mmkit server — starting";
      lspItem.text = "$(sync~spin) LSP";
      lspItem.tooltip = "ConceptBase LSP — starting";
      operationalItem.show();
      lspItem.show();
    },

    update(states: StatusBarActorStates, snapshot?: ConfigSnapshot) {
      const label = operationalLabel(states.mode);
      const opState = operationalState(states) ?? states.supervisor ?? "Bootstrapping";
      operationalItem.text = `${stateGlyph(opState)} ${label}`;
      operationalItem.tooltip = operationalTooltip(states, snapshot, label);

      const lspState = states.languageServer ?? "Starting";
      lspItem.text = `${stateGlyph(lspState)} LSP`;
      lspItem.tooltip = languageServerTooltip(states);
    },

    dispose() {
      operationalItem.dispose();
      lspItem.dispose();
    },
  };
}
