import * as path from "node:path";
import type { ResolvedPaths } from "@mmkit/shared";
import { isInstallationComplete, materializeInstallAssets } from "../../../cbserver/mmkit-server/install/materialize";
import type { AssetPort, InstallProgressCallback } from "../types";

export class RealAssetPort implements AssetPort {
  constructor(private readonly assetRoot: string) {}

  getAssetRoot(): string {
    return this.assetRoot;
  }

  isInstallationComplete(paths: ResolvedPaths): Promise<boolean> {
    return isInstallationComplete(paths);
  }

  materialize(paths: ResolvedPaths, onProgress?: InstallProgressCallback): Promise<void> {
    return materializeInstallAssets(this.assetRoot, paths, onProgress);
  }
}

export function resolveAssetRoot(): string {
  if (process.env.MMKIT_ASSET_ROOT) {
    return path.resolve(process.env.MMKIT_ASSET_ROOT);
  }
  return path.resolve(__dirname, "..", "..", "..", "..", "extension", "assets", "cbserver");
}
