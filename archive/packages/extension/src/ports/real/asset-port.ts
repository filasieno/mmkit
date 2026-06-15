import * as path from "node:path";
import type { ExtensionContext } from "vscode";
import { isInstallationComplete, materializeInstallAssets } from "../../install/materialize";
import type { ResolvedPaths } from "../../types";
import type { InstallProgressCallback } from "../../install/progress";
import type { AssetPort } from "../types";

export class RealAssetPort implements AssetPort {
  constructor(private readonly context?: ExtensionContext) {}

  getAssetRoot(): string {
    if (this.context) {
      return path.join(this.context.extensionPath, "assets", "cbserver");
    }
    return path.join(__dirname, "..", "..", "..", "assets", "cbserver");
  }

  isInstallationComplete(paths: ResolvedPaths): Promise<boolean> {
    return isInstallationComplete(paths);
  }

  materialize(paths: ResolvedPaths, onProgress?: InstallProgressCallback): Promise<void> {
    return materializeInstallAssets(this.getAssetRoot(), paths, onProgress);
  }
}
