import * as os from "node:os";
import * as path from "node:path";
import { INSTALL_MARKER_FILE } from "../constants";
import type { ResolvedPaths, ServerSettings } from "../types";

export function expandHome(input: string): string {
  if (!input) {
    return input;
  }
  if (input === "~") {
    return os.homedir();
  }
  if (input.startsWith("~/")) {
    return path.join(os.homedir(), input.slice(2));
  }
  return input;
}

export function resolveServerPaths(server: ServerSettings): ResolvedPaths {
  const dataDir = path.resolve(expandHome(server.dataDir || "~/.mmkit"));
  const databaseAllPath = server.databaseAllPath
    ? path.resolve(expandHome(server.databaseAllPath))
    : path.join(dataDir, "workspace");
  const tmpDir = server.tmpDir ? path.resolve(expandHome(server.tmpDir)) : path.join(dataDir, "tmp");
  const loadDir = server.loadDir ? path.resolve(expandHome(server.loadDir)) : path.join(dataDir, "load");

  return {
    dataDir,
    databaseAllPath,
    tmpDir,
    loadDir,
    databasePath: server.databasePath ? path.resolve(expandHome(server.databasePath)) : "",
    newDatabasePath: server.newDatabasePath ? path.resolve(expandHome(server.newDatabasePath)) : "",
    saveDir: server.saveDir ? path.resolve(expandHome(server.saveDir)) : "",
    viewsDir: server.viewsDir ? path.resolve(expandHome(server.viewsDir)) : "",
    installMarker: path.join(dataDir, INSTALL_MARKER_FILE),
  };
}

export function requiredDataDirectories(paths: ResolvedPaths): string[] {
  const dirs = [paths.dataDir, paths.tmpDir, paths.loadDir];
  if (paths.databaseAllPath) {
    dirs.push(paths.databaseAllPath);
  }
  if (paths.databasePath) {
    dirs.push(paths.databasePath);
  }
  if (paths.newDatabasePath) {
    dirs.push(path.dirname(paths.newDatabasePath));
  }
  return [...new Set(dirs)];
}
