import { RealAssetPort, resolveAssetRoot } from "./real/asset-port";
import { RealDockerPort } from "./real/docker-port";
import { RealFsPort } from "./real/fs-port";
import { RealNetworkPort } from "./real/network-port";
import { RealProcessPort } from "./real/process-port";
import type { MmkitServerPorts } from "./types";

export function createRealPorts(assetRoot?: string): MmkitServerPorts {
  return {
    fs: new RealFsPort(),
    assets: new RealAssetPort(assetRoot ?? resolveAssetRoot()),
    process: new RealProcessPort(),
    docker: new RealDockerPort(),
    network: new RealNetworkPort(),
  };
}

export type { MmkitServerPorts };
