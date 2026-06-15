import { resolveExecutableCommand } from "@mmkit/shared";
import { DOCKER_IMAGE_RUNTIME } from "./docker-defaults";
import type { ConfigSnapshot, LaunchSpec, RawMmkitSettings, ValidationError } from "../types";
import { requiredDataDirectories, resolveServerPaths } from "./paths";

function setIfNonEmpty(env: Record<string, string>, key: string, value: string | number | boolean | undefined): void {
  if (value === undefined || value === null) {
    return;
  }
  if (typeof value === "string" && value === "") {
    return;
  }
  env[key] = String(value);
}

export function validateSettings(raw: RawMmkitSettings): ValidationError[] {
  const errors: ValidationError[] = [];
  if (raw.server.port < 1 || raw.server.port > 65535) {
    errors.push({ field: "mmkit.server.port", message: "Port must be between 1 and 65535" });
  }
  if (raw.client.port < 1 || raw.client.port > 65535) {
    errors.push({ field: "mmkit.client.port", message: "Port must be between 1 and 65535" });
  }
  if (
    raw.operationalMode === "internalServer" &&
    raw.server.launchKind === "executable" &&
    !raw.server.executablePath &&
    !raw.server.devCommand
  ) {
    // Installed copy at dataDir/bin/cbserver is used after materialize.
  }
  if (raw.operationalMode === "client" && !raw.client.host) {
    errors.push({ field: "mmkit.client.host", message: "Client host is required" });
  }
  return errors;
}

export function buildSnapshot(raw: RawMmkitSettings, generation: number, resource?: ConfigSnapshot["resource"]): ConfigSnapshot {
  const paths = resolveServerPaths(raw.server);
  const errors = validateSettings(raw);
  return {
    generation,
    resource,
    operationalMode: raw.operationalMode,
    traceLevel: raw.traceLevel,
    server: { ...raw.server },
    client: { ...raw.client },
    paths,
    valid: errors.length === 0,
    errors,
  };
}

/** Environment for local executable launch (includes install-tree paths). */
export function executableLaunchEnv(snapshot: ConfigSnapshot): Record<string, string> {
  const s = snapshot.server;
  const p = snapshot.paths;
  const env: Record<string, string> = {
    CB_HOME: DOCKER_IMAGE_RUNTIME.cbHome,
    CB_POOL: DOCKER_IMAGE_RUNTIME.cbPool,
    CBS_DIR: DOCKER_IMAGE_RUNTIME.cbsDir,
    CBL_DIR: DOCKER_IMAGE_RUNTIME.cblDir,
    CB_PORTNR: String(s.port),
    PROLOG_VARIANT: DOCKER_IMAGE_RUNTIME.prologVariant,
    TMPDIR: p.tmpDir,
    CB_UPDATE_MODE: s.updateMode,
  };

  setIfNonEmpty(env, "CB_VARIANT", DOCKER_IMAGE_RUNTIME.cbVariant);
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

/** Environment passed to Docker — only user-tunable flags; install tree is inside the image. */
export function dockerContainerEnv(snapshot: ConfigSnapshot): Record<string, string> {
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

function applyOptionalServerFlags(env: Record<string, string>, s: ConfigSnapshot["server"]): void {
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

export function buildLaunchSpec(snapshot: ConfigSnapshot): LaunchSpec {
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

export { requiredDataDirectories };
