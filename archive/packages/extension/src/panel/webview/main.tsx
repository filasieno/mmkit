import { createRoot } from "react-dom/client";
import type { PanelInteraction, PanelViewModel } from "../../types";
import { PanelComponent } from "./PanelComponent";
import "./panel.css";

declare const acquireVsCodeApi: () => {
  postMessage(message: unknown): void;
};

const vscode = acquireVsCodeApi();

let viewModel: PanelViewModel = {
  title: "Metamodelling Kit",
  operationalMode: "none",
  serverState: "Disabled",
  clientState: "Disabled",
  snapshotValid: false,
  port: 4001,
  host: "127.0.0.1",
  traceLevel: "trace",
  actions: [],
  statusMessage: "Loading…",
};

function postInteraction(interaction: PanelInteraction): void {
  vscode.postMessage({ type: "interaction", payload: interaction });
}

const root = createRoot(document.getElementById("root")!);
root.render(
  <PanelComponent
    viewModel={viewModel}
    onAction={(actionId) => postInteraction({ kind: "click", actionId })}
    onKeyDown={(key, actionId) => postInteraction({ kind: "keydown", actionId: actionId ?? "panel", key })}
  />
);

function rerender(): void {
  root.render(
    <PanelComponent
      viewModel={viewModel}
      onAction={(actionId) => postInteraction({ kind: "click", actionId })}
      onKeyDown={(key, actionId) => postInteraction({ kind: "keydown", actionId: actionId ?? "panel", key })}
    />
  );
}

window.addEventListener("message", (event) => {
  const message = event.data as { type?: string; payload?: PanelViewModel };
  if (message?.type === "viewModel" && message.payload) {
    viewModel = message.payload;
    rerender();
  }
});

vscode.postMessage({ type: "webviewReady" });
