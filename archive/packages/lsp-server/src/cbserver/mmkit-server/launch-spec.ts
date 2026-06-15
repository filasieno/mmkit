import * as path from "node:path";
import type { ConfigSnapshotPayload, LaunchSpec } from "@mmkit/shared";
import { DOCKER_IMAGE_RUNTIME } from "./docker-defaults";
import { resolveExecutableCommand } from "./executable-path";

function setIfNonEmpty(env: Record<string, string>, key: string, value: string | number | boolean | undefined): void {
  if (value === undefined || value === null) return;
  if (typeof value === "string" && value === "") return;
  env[key] = String(value);
}

function isNativeBundledExecutable(snapshot: ConfigSnapshotPayload): boolean {
  const s = snapshot.server;
  if (s.devCommand) return true;
  if (process.env.MMKIT_CBSERVER_BIN) return true;
  const cmd = resolveExecutableCommand(snapshot.paths, s.executablePath, s.devCommand);
  return cmd.includes("/nix/store/") || path.isAbsolute(cmd);
}

export function executableLaunchEnv(snapshot: ConfigSnapshotPayload): Record<string, string> {
  const s = snapshot.server;
  const p = snapshot.paths;
  const native = isNativeBundledExecutable(snapshot);

  const env: Record<string, string> = {
    CB_PORTNR: String(s.port),
    TMPDIR: p.tmpDir,
    CB_UPDATE_MODE: s.updateMode,
  };

  if (!native) {
    env.CB_HOME = DOCKER_IMAGE_RUNTIME.cbHome;
    env.CB_POOL = DOCKER_IMAGE_RUNTIME.cbPool;
    env.CBS_DIR = DOCKER_IMAGE_RUNTIME.cbsDir;
    env.CBL_DIR = DOCKER_IMAGE_RUNTIME.cblDir;
    env.PROLOG_VARIANT = DOCKER_IMAGE_RUNTIME.prologVariant;
    setIfNonEmpty(env, "CB_VARIANT", DOCKER_IMAGE_RUNTIME.cbVariant);
  }
  if (s.newDatabasePath && p.newDatabasePath) {
    env.CB_NEW_DATABASE = p.newDatabasePath;
  } else if (p.databaseAllPath) {
    env.CB_DB_ALL = p.databaseAllPath;
  } else if (p.databasePath) {
    env.CB_DATABASE = p.databasePath;
    if (s.resetOnStart) {
      env.CB_RESET_ON_START = "1";
    }
  }

  setIfNonEmpty(env, "CB_LOAD_DIR", p.loadDir);
  setIfNonEmpty(env, "CB_SAVE_DIR", p.saveDir);
  setIfNonEmpty(env, "CB_VIEWS_DIR", p.viewsDir);
  applyOptionalServerFlags(env, s);
  return env;
}

export function dockerContainerEnv(snapshot: ConfigSnapshotPayload): Record<string, string> {
  const s = snapshot.server;
  const env: Record<string, string> = {
    CB_PORTNR: String(s.port),
    CB_UPDATE_MODE: s.updateMode,
    TMPDIR: DOCKER_IMAGE_RUNTIME.containerTmp,
    CB_DB_ALL: DOCKER_IMAGE_RUNTIME.containerWorkspace,
    CB_LOAD_DIR: "/data/load",
    CB_SERVER_MODE: s.serverMode || "master",
    CB_TRACEMODE: s.traceMode || "no",
  };

  applyOptionalServerFlags(env, s);
  return env;
}

function applyOptionalServerFlags(env: Record<string, string>, s: ConfigSnapshotPayload["server"]): void {
  setIfNonEmpty(env, "CB_UNTELL_MODE", s.untellMode);
  setIfNonEmpty(env, "CB_CACHE_MODE", s.cacheMode);
  setIfNonEmpty(env, "CB_CACHE_SIZE", s.cacheSize);
  setIfNonEmpty(env, "CB_OPT_MODE", s.optimizerMode);
  setIfNonEmpty(env, "CB_VIEWS_MAINT", s.viewsMaintenance);
  setIfNonEmpty(env, "CB_RESTART_SECS", s.restartDelaySeconds);
  setIfNonEmpty(env, "CB_SECURITY_LEVEL", s.securityLevel);
  setIfNonEmpty(env, "CB_MAX_ERRORS", s.maxErrors);
  setIfNonEmpty(env, "CB_ADMIN_USER", s.adminUser);
  if (s.multiUser) {
    env.CB_MULTI_USER = "1";
  }
  setIfNonEmpty(env, "CB_MODULE_SEPARATOR", s.moduleSeparator);
  setIfNonEmpty(env, "CB_MODULE_GENERATION", s.moduleGeneration);
  setIfNonEmpty(env, "CB_CC_MODE", s.ccMode);
  setIfNonEmpty(env, "CB_MAX_COST", s.maxCost);
  setIfNonEmpty(env, "CB_PATH_LENGTH", s.pathLength);
  setIfNonEmpty(env, "CB_ITER_MAX", s.iterMax);
  setIfNonEmpty(env, "CB_ECA_MODE", s.ecaMode);
  setIfNonEmpty(env, "CB_ECA_OPTIMIZER", s.ecaOptimizer);
  setIfNonEmpty(env, "CB_RULE_LABELS", s.ruleLabels);
  setIfNonEmpty(env, "CB_INACTIVITY_HOURS", s.inactivityHours);
  setIfNonEmpty(env, "CB_STRATIFICATION_MODE", s.stratificationMode);
}

export function buildLaunchSpec(snapshot: ConfigSnapshotPayload): LaunchSpec {
  const s = snapshot.server;
  const p = snapshot.paths;

  if (s.launchKind === "docker") {
    const env = dockerContainerEnv(snapshot);
    const args = [
      "run",
      "--rm",
      "--name",
      s.dockerContainerName,
      "-p",
      `${s.port}:${s.port}`,
      "-v",
      `${p.databaseAllPath}:${DOCKER_IMAGE_RUNTIME.containerWorkspace}`,
      "-v",
      `${p.tmpDir}:${DOCKER_IMAGE_RUNTIME.containerTmp}`,
      "-v",
      `${p.loadDir}:/data/load:ro`,
      ...s.dockerExtraRunArgs,
    ];
    for (const [key, value] of Object.entries(env)) {
      args.push("-e", `${key}=${value}`);
    }
    args.push(s.dockerImage);
    return { kind: "docker", command: "docker", args, env: {} };
  }

  const env = executableLaunchEnv(snapshot);
  const command = resolveExecutableCommand(p, s.executablePath, s.devCommand);
  const args: string[] = [...s.extraArgs];

  if (env.CB_NEW_DATABASE) {
    args.push("-new", env.CB_NEW_DATABASE);
  } else if (env.CB_DB_ALL) {
    args.push("-db", env.CB_DB_ALL);
  } else if (env.CB_DATABASE) {
    if (env.CB_RESET_ON_START === "1") {
      args.push("-new", env.CB_DATABASE);
    } else {
      args.push("-d", env.CB_DATABASE);
    }
  }

  args.push("-u", env.CB_UPDATE_MODE || "persistent");
  if (env.CB_LOAD_DIR) args.push("-load", env.CB_LOAD_DIR);
  if (env.CB_SAVE_DIR) args.push("-save", env.CB_SAVE_DIR);
  if (env.CB_VIEWS_DIR) args.push("-views", env.CB_VIEWS_DIR);
  args.push("-p", String(s.port));

  return { kind: "executable", command, args, env };
}
