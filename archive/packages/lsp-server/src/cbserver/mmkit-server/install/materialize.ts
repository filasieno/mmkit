import * as fs from "node:fs/promises";
import * as path from "node:path";
import { chmod } from "node:fs/promises";
import { INSTALL_MARKER_FILE, type ResolvedPaths } from "@mmkit/shared";
import type { InstallProgressCallback } from "../../../shared/ports/types";

function resolveExecutableSource(assetRoot: string, bundleName: string): string {
  if (process.env.MMKIT_CBSERVER_BIN) {
    return path.resolve(process.env.MMKIT_CBSERVER_BIN);
  }
  return path.join(assetRoot, bundleName);
}

export interface InstallManifest {
  version: number;
  markerFile: string;
  directories: string[];
  workspaceFiles?: string[];
  executable?: {
    bundleName: string;
    installRelPath: string;
  };
}

export function installMarkerPath(paths: ResolvedPaths): string {
  return path.join(paths.dataDir, INSTALL_MARKER_FILE);
}

export async function readManifest(assetRoot: string): Promise<InstallManifest> {
  const raw = await fs.readFile(path.join(assetRoot, "manifest.json"), "utf8");
  return JSON.parse(raw) as InstallManifest;
}

export async function isInstallationComplete(paths: ResolvedPaths): Promise<boolean> {
  try {
    await fs.access(installMarkerPath(paths));
    return true;
  } catch {
    return false;
  }
}

export async function materializeInstallAssets(
  assetRoot: string,
  paths: ResolvedPaths,
  onProgress?: InstallProgressCallback
): Promise<void> {
  const report = (message: string, fraction: number): void => {
    onProgress?.(message, fraction);
  };

  report("Reading installation manifest…", 0);
  const manifest = await readManifest(assetRoot);

  let loadFileCount = 0;
  try {
    const loadEntries = await fs.readdir(path.join(assetRoot, "load"), { withFileTypes: true });
    loadFileCount = loadEntries.filter((e) => e.isFile()).length;
  } catch {
    loadFileCount = 0;
  }

  const executableUnits = manifest.executable ? 1 : 0;
  const workUnits =
    1 + manifest.directories.length + (manifest.workspaceFiles?.length ?? 0) + loadFileCount + executableUnits + 1;
  let done = 1;

  const tick = (message: string): void => {
    report(message, done / workUnits);
    done += 1;
  };

  for (const dir of manifest.directories) {
    const target =
      dir === "workspace"
        ? paths.databaseAllPath
        : dir === "tmp"
          ? paths.tmpDir
          : path.join(paths.dataDir, dir);
    tick(`Creating ${dir} directory…`);
    await fs.mkdir(target, { recursive: true });
  }

  const workspaceSrc = path.join(assetRoot, "workspace");
  for (const file of manifest.workspaceFiles ?? []) {
    const src = path.join(workspaceSrc, file);
    const dest = path.join(paths.databaseAllPath, file);
    try {
      await fs.access(dest);
      tick(`Workspace file ${file} already present`);
    } catch {
      tick(`Copying workspace file ${file}…`);
      await fs.copyFile(src, dest);
    }
  }

  const loadSrc = path.join(assetRoot, "load");
  const loadDest = path.join(paths.dataDir, "load");
  await fs.mkdir(loadDest, { recursive: true });
  try {
    const entries = await fs.readdir(loadSrc, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const dest = path.join(loadDest, entry.name);
      try {
        await fs.access(dest);
        tick(`Load file ${entry.name} already present`);
      } catch {
        tick(`Copying load file ${entry.name}…`);
        await fs.copyFile(path.join(loadSrc, entry.name), dest);
      }
    }
  } catch {
    // optional load/ seed
  }

  if (manifest.executable) {
    if (process.env.MMKIT_CBSERVER_BIN) {
      tick(`Using MMKIT_CBSERVER_BIN for ${manifest.executable.bundleName} (not copied into dataDir)`);
    } else {
      const dest = path.join(paths.dataDir, manifest.executable.installRelPath);
      await fs.mkdir(path.dirname(dest), { recursive: true });
      const source = resolveExecutableSource(assetRoot, manifest.executable.bundleName);
      try {
        await fs.access(dest);
        tick(`Executable ${manifest.executable.bundleName} already present`);
      } catch {
        tick(`Copying ${manifest.executable.bundleName} executable…`);
        await fs.copyFile(source, dest);
        try {
          await chmod(dest, 0o755);
        } catch {
          // best effort on platforms without chmod semantics
        }
      }
    }
  }

  tick("Writing installation marker…");
  const marker = path.join(paths.dataDir, manifest.markerFile || INSTALL_MARKER_FILE);
  await fs.writeFile(
    marker,
    JSON.stringify({ version: manifest.version, installedAt: new Date().toISOString() }, null, 2),
    "utf8"
  );
  report("Workspace assets installed", 1);
}
