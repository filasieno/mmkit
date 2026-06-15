import type { ExtensionContext } from "vscode";
import type { MmkitPorts } from "./types";
import { createSimPorts } from "./sim/sim-ports";
import { RealAssetPort } from "./real/asset-port";
import { RealDockerPort } from "./real/docker-port";
import { RealFsPort } from "./real/fs-port";
import { RealNetworkPort } from "./real/network-port";
import { RealProcessPort } from "./real/process-port";
import { RealPanelPort } from "./real/panel-port";
import { RealTcpPort } from "./real/tcp-port";
import { RealUiPort } from "./real/ui-port";
import { RealVscodeConfigPort } from "./real/vscode-config-port";

export type PortMode = "sim" | "real";

export function createPorts(mode: PortMode, context?: ExtensionContext): MmkitPorts {
  if (mode === "sim") {
    return createSimPorts();
  }
  return {
    vscodeConfig: new RealVscodeConfigPort(),
    fs: new RealFsPort(),
    assets: new RealAssetPort(context),
    ui: new RealUiPort(),
    process: new RealProcessPort(),
    docker: new RealDockerPort(),
    network: new RealNetworkPort(),
    tcp: new RealTcpPort(),
    panel: new RealPanelPort(),
  };
}

export { createSimPorts };
export type { MmkitPorts };
