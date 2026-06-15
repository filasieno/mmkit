import type { ConfigSnapshot, OtelTraceLevel, PanelActionViewModel, PanelViewModel } from "../types";

export interface PanelStateInput {
  snapshot?: ConfigSnapshot;
  serverState?: string;
  clientState?: string;
  traceLevel: OtelTraceLevel;
}

export function buildPanelViewModel(input: PanelStateInput): PanelViewModel {
  const snapshot = input.snapshot;
  const mode = snapshot?.operationalMode ?? "none";
  const serverState = input.serverState ?? "Disabled";
  const clientState = input.clientState ?? "Disabled";
  const valid = snapshot?.valid ?? false;
  const port = snapshot?.server.port ?? 4001;
  const host = snapshot?.client.host ?? "127.0.0.1";

  const actions: PanelActionViewModel[] = [];

  if (mode === "internalServer") {
    const running = serverState === "Running";
    const busy = serverState.startsWith("Installing") || serverState === "Starting" || serverState === "Stopping";
    actions.push({
      id: "startServer",
      label: running || busy ? "Starting…" : "Start cbserver",
      enabled: valid && !running && !busy,
      variant: "primary",
    });
    actions.push({
      id: "stopServer",
      label: "Stop cbserver",
      enabled: running || busy || serverState === "Stopping",
      variant: "danger",
    });
  } else if (mode === "client") {
    const connected = clientState === "Connected";
    const busy = clientState === "Connecting" || clientState === "Disconnecting";
    actions.push({
      id: "connect",
      label: connected || busy ? "Connecting…" : "Connect",
      enabled: valid && !connected && !busy,
      variant: "primary",
    });
    actions.push({
      id: "disconnect",
      label: "Disconnect",
      enabled: connected || busy,
      variant: "danger",
    });
  }

  actions.push({
    id: "openSettings",
    label: "Open settings",
    enabled: true,
    variant: "secondary",
  });

  const statusMessage =
    mode === "internalServer"
      ? `Server: ${serverState} · port ${port}`
      : mode === "client"
        ? `Client: ${clientState} · ${host}:${port}`
        : "mmkit idle (operational mode: none)";

  return {
    title: "Metamodelling Kit",
    operationalMode: mode,
    serverState,
    clientState,
    snapshotValid: valid,
    port,
    host,
    traceLevel: input.traceLevel,
    actions,
    statusMessage,
  };
}
