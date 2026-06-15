import * as fs from "node:fs";
import * as path from "node:path";
import { CBSERVER_INSTALL_REL_PATH } from "./constants";
import type { ResolvedPaths } from "./config";

export function installedCbserverPath(paths: ResolvedPaths): string {
  return path.join(paths.dataDir, CBSERVER_INSTALL_REL_PATH);
}

function envCbserverBin(): string | undefined {
  const bin = process.env.MMKIT_CBSERVER_BIN;
  if (!bin) return undefined;
  const resolved = path.resolve(bin);
  try {
    fs.accessSync(resolved, fs.constants.X_OK);
    return resolved;
  } catch {
    try {
      fs.accessSync(resolved);
      return resolved;
    } catch {
      return undefined;
    }
  }
}

export function resolveExecutableCommand(
  paths: ResolvedPaths,
  executablePath: string,
  devCommand?: string
): string {
  if (devCommand) {
    return devCommand;
  }
  const fromEnv = envCbserverBin();
  if (fromEnv) {
    return fromEnv;
  }
  const installed = installedCbserverPath(paths);
  try {
    fs.accessSync(installed, fs.constants.X_OK);
    return installed;
  } catch {
    // fall through
  }
  try {
    fs.accessSync(installed);
    return installed;
  } catch {
    // fall through
  }
  if (executablePath) {
    return executablePath;
  }
  return installed;
}
