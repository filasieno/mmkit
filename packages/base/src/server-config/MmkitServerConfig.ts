import { homedir } from "node:os";
import path from "node:path";

/**
 * Persistent cbserver launch and runtime configuration (executable mode).
 *
 * Canonical server-side contract consumed by {@link @mmkit/server}. Field
 * documentation follows the ConceptBase user manual (`sec:cbsparams`) and
 * `docs/CONFIGURATION.md`.
 *
 * @see {@link cbserver.1} for CLI synopsis (`-d`, `-db`, `-p`, `-u`, …).
 */
export type MmkitServerUpdateMode = "persistent" | "nonpersistent";

/** {@link cbserver.1} `-t` / user manual `sec:cbsparams`. */
export type MmkitServerTraceMode = "silent" | "no" | "minimal" | "low" | "high" | "veryhigh";

/** {@link cbserver.1} `-U`. */
export type MmkitServerUntellMode = "verbatim" | "cleanup";

/** {@link cbserver.1} `-c`. */
export type MmkitServerCacheMode = "off" | "transient" | "keep";

/** {@link cbserver.1} `-o` — `0` none … `4` structural + join + trigger pruning (recommended). */
export type MmkitServerOptimizerMode = 0 | 1 | 2 | 3 | 4;

/** {@link cbserver.1} `-v`. */
export type MmkitServerViewsMaintenance = "on" | "off";

/** {@link cbserver.1} `-s` — `0` none … `3` read-mostly frozen state. */
export type MmkitServerSecurityLevel = 0 | 1 | 2 | 3;

/** {@link cbserver.1} `-mu`. */
export type MmkitServerMultiUserMode = "enabled" | "disabled";

/** {@link cbserver.1} `-ms`. */
export type MmkitServerModuleSeparator = "-" | "/";

/** {@link cbserver.1} `-mg`. */
export type MmkitServerModuleGeneration = "split" | "whole" | "minsplit";

/** {@link cbserver.1} `-cc`. */
export type MmkitServerCcMode = "strict" | "extended" | "off";

/** {@link cbserver.1} `-eca`. */
export type MmkitServerEcaMode = "safe" | "unsafe" | "off";

/** {@link cbserver.1} `-eo`. */
export type MmkitServerEcaOptimizer = "on" | "off";

/** {@link cbserver.1} `-rl`. */
export type MmkitServerRuleLabels = "on" | "off";

/** {@link cbserver.1} `-sm`. */
export type MmkitServerServerMode = "master" | "slave";

/** {@link cbserver.1} `-st`. */
export type MmkitServerStratificationMode = "on" | "off";

/** {@link cbserver.1} `-g`. Empty = no special command. */
export type MmkitServerDevCommand = "nolpi" | "public" | "exit";

export const MMKIT_SERVER_UPDATE_MODES = ["persistent", "nonpersistent"] as const satisfies readonly MmkitServerUpdateMode[];
export const MMKIT_SERVER_TRACE_MODES = ["silent", "no", "minimal", "low", "high", "veryhigh"] as const satisfies readonly MmkitServerTraceMode[];
export const MMKIT_SERVER_OPTIMIZER_MODES = [0, 1, 2, 3, 4] as const satisfies readonly MmkitServerOptimizerMode[];
export const MMKIT_SERVER_SECURITY_LEVELS = [0, 1, 2, 3] as const satisfies readonly MmkitServerSecurityLevel[];

/**
 * Process launch: binary path, dev overrides, passthrough CLI tokens.
 *
 * @see {@link cbserver.1} SYNOPSIS
 */
export interface IMmkitServerLaunchSettings {
  /**
   * Path to the `cbserver` binary (name resolved via `PATH` when relative).
   * @mapsTo executable argv[0]
   */
  executablePath: string;

  /**
   * Override launch command for development (replaces `executablePath` resolution).
   * @mapsTo launch wrapper
   */
  devCommand: string;

  /**
   * Start the internal cbserver automatically when configuration is valid.
   */
  autoStartup: boolean;

  /**
   * Additional cbserver CLI arguments appended after mmkit-built flags.
   * @mapsTo trailing argv
   */
  extraArgs: string[];
}

/**
 * TCP listen endpoint for client connections.
 *
 * @see user manual `-port` / `-p` (`sec:cbsparams`)
 */
export interface IMmkitServerNetworkSettings {
  /**
   * TCP port for client connections (`2000`–`65535`).
   * @default 4001
   * @mapsTo `CB_PORTNR` / `-p`
   */
  port: number;

  /** Poll attempts while waiting for cbserver to accept TCP (`SpawnArmed`). */
  portProbeMaxAttempts: number;

  /** Delay between port-probe attempts (ms). */
  portProbeIntervalMs: number;

  /** Per-probe TCP connect timeout (ms). */
  portProbeConnectTimeoutMs: number;
}

/**
 * Data directories and database persistency layout under {@link IMmkitServerPathSettings.dataDir}.
 *
 * Empty path fields are resolved at launch time from `dataDir` (see `CONFIGURATION.md`).
 */
export interface IMmkitServerPathSettings {
  /**
   * Base directory for mmkit-owned cbserver data (`~` expanded at launch).
   * @default `~/.mmkit`
   */
  dataDir: string;

  /**
   * Update persistency: `persistent` keeps tells across restarts; `nonpersistent` is ephemeral.
   * @default `persistent`
   * @mapsTo `CB_UPDATE_MODE` / `-u`
   */
  updateMode: MmkitServerUpdateMode;

  /**
   * Primary knowledge-base directory (database only).
   * @mapsTo `CB_DATABASE` / `-d`
   */
  databasePath: string;

  /**
   * Combined workspace: database, module save, and views in one directory.
   * @mapsTo `CB_DB_ALL` / `-db`
   */
  databaseAllPath: string;

  /**
   * Erase any existing database at this path, then create a fresh one.
   * @mapsTo `CB_NEW_DATABASE` / `-new`
   */
  newDatabasePath: string;

  /**
   * With `databasePath` set, use `-new` instead of `-d` on every start.
   * @mapsTo `CB_RESET_ON_START`
   */
  resetOnStart: boolean;

  /**
   * Parent directory for nonpersistent per-session database copies.
   * Empty → `${dataDir}/tmp`.
   * @mapsTo `TMPDIR`
   */
  tmpDir: string;

  /**
   * Module sources (`*.sml`) loaded at startup (`-load`). Empty = none.
   * @mapsTo `CB_LOAD_DIR` / `-load`
   */
  loadDir: string;

  /**
   * Module listings written on shutdown or client logout (`-save`). Empty = disabled.
   * @mapsTo `CB_SAVE_DIR` / `-save`
   */
  saveDir: string;

  /**
   * Materialized query results (`-views`). Empty = disabled.
   * @mapsTo `CB_VIEWS_DIR` / `-views`
   */
  viewsDir: string;
}

/**
 * cbserver runtime behaviour flags (trace, cache, security, ECA, …).
 *
 * @see user manual `sec:cbsparams`
 */
export interface IMmkitServerRuntimeSettings {
  /**
   * Diagnostic trace amount (`-t`). Does not change functional behaviour.
   * @default `no`
   * @mapsTo `CB_TRACEMODE` / `-t`
   */
  traceMode: MmkitServerTraceMode;

  /**
   * How UNTELL removes objects (`-U`).
   * @default `cleanup`
   * @mapsTo `CB_UNTELL_MODE` / `-U`
   */
  untellMode: MmkitServerUntellMode;

  /**
   * Query cache for recursive evaluation (`-c`).
   * @default `keep`
   * @mapsTo `CB_CACHE_MODE` / `-c`
   */
  cacheMode: MmkitServerCacheMode;

  /**
   * Maximum derived facts retained in the query cache between transactions (`-cs`).
   * @default 60000
   * @mapsTo `CB_CACHE_SIZE` / `-cs`
   */
  cacheSize: number;

  /**
   * Rule, constraint, and query optimizer level (`-o`).
   * @default 4
   * @mapsTo `CB_OPT_MODE` / `-o`
   */
  optimizerMode: MmkitServerOptimizerMode;

  /**
   * Generate view maintenance rules on updates (`-v`).
   * @default `off`
   * @mapsTo `CB_VIEWS_MAINT` / `-v`
   */
  viewsMaintenance: MmkitServerViewsMaintenance;

  /**
   * Seconds to wait before auto-restart after a crash (`-r`). `undefined` = disabled.
   * @mapsTo `CB_RESTART_SECS` / `-r`
   */
  restartDelaySeconds?: number;

  /**
   * Access control strictness (`-s`).
   * @default 1
   * @mapsTo `CB_SECURITY_LEVEL` / `-s`
   */
  securityLevel: MmkitServerSecurityLevel;

  /**
   * Maximum errors reported to a client per transaction (`-e`). `-1` = unlimited.
   * @default 20
   * @mapsTo `CB_MAX_ERRORS` / `-e`
   */
  maxErrors: number;

  /**
   * Extra user allowed to shut down the server (`-a`). May include `@host` suffix.
   * @mapsTo `CB_ADMIN_USER` / `-a`
   */
  adminUser: string;

  /**
   * Allow multiple distinct user names to connect (`-mu`).
   * @default `enabled`
   * @mapsTo `CB_MULTI_USER` / `-mu`
   */
  multiUser: MmkitServerMultiUserMode;

  /**
   * Flat (`-`) vs nested (`/`) layout for saved modules and views (`-ms`).
   * @default `-`
   * @mapsTo `CB_MODULE_SEPARATOR` / `-ms`
   */
  moduleSeparator: MmkitServerModuleSeparator;

  /**
   * Transaction separators in generated `*.sml` listings (`-mg`).
   * @default `split`
   * @mapsTo `CB_MODULE_GENERATION` / `-mg`
   */
  moduleGeneration: MmkitServerModuleGeneration;

  /**
   * Attribution predicate typing strictness in queries (`-cc`).
   * @default `strict`
   * @mapsTo `CB_CC_MODE` / `-cc`
   */
  ccMode: MmkitServerCcMode;

  /**
   * Maximum cost for predicates on meta-formula binding paths (`-mc`).
   * @default 100
   * @mapsTo `CB_MAX_COST` / `-mc`
   */
  maxCost: number;

  /**
   * Maximum binding path length for meta-formula compilation (`-pl`). `0` disables compilation.
   * @default 5
   * @mapsTo `CB_PATH_LENGTH` / `-pl`
   */
  pathLength: number;

  /**
   * Iterations for reordering single-free-variable attribution predicates (`-im`).
   * @default 3
   * @mapsTo `CB_ITER_MAX` / `-im`
   */
  iterMax: number;

  /**
   * Event-condition-action rule evaluation mode (`-eca`).
   * @default `safe`
   * @mapsTo `CB_ECA_MODE` / `-eca`
   */
  ecaMode: MmkitServerEcaMode;

  /**
   * Re-order predicates in ECA rule conditions (`-eo`).
   * @default `on`
   * @mapsTo `CB_ECA_OPTIMIZER` / `-eo`
   */
  ecaOptimizer: MmkitServerEcaOptimizer;

  /**
   * Readable labels for generated formulas (`-rl`).
   * @default `on`
   * @mapsTo `CB_RULE_LABELS` / `-rl`
   */
  ruleLabels: MmkitServerRuleLabels;

  /**
   * Hours of client activity before treating a client as active (`-ia`). Negative = infinity.
   * @default 2
   * @mapsTo `CB_INACTIVITY_HOURS` / `-ia`
   */
  inactivityHours: number;

  /**
   * `master` stays up until stopped; `slave` may exit when the last client leaves (`-sm`).
   * @default `master`
   * @mapsTo `MMKIT_SERVER_MODE` / `-sm`
   */
  serverMode: MmkitServerServerMode;

  /**
   * Dynamic rule stratification violation checks (`-st`).
   * @default `on`
   * @mapsTo `CB_STRATIFICATION_MODE` / `-st`
   */
  stratificationMode: MmkitServerStratificationMode;

  /**
   * Special startup command (`-g`): ignore plugins, public server, or exit after materialization.
   * `undefined` = no `-g` flag.
   * @mapsTo `CB_DEV_CMD` / `-g`
   */
  devCommand?: MmkitServerDevCommand;
}

/**
 * mmkit-specific actor settings (not passed directly as cbserver CLI flags).
 */
export interface IMmkitServerActorSettings {
  /** Milliseconds between SIGTERM and SIGKILL when stopping the subprocess. */
  killGraceMs: number;

  /** Tool name sent during ENROLL_ME IPC. */
  clientToolName: string;

  /** User name sent during ENROLL_ME IPC. */
  clientUserName: string;
}

export type MmkitServerConfigInit = {
  launch?: Partial<IMmkitServerLaunchSettings>;
  network?: Partial<IMmkitServerNetworkSettings>;
  paths?: Partial<IMmkitServerPathSettings>;
  runtime?: Partial<IMmkitServerRuntimeSettings>;
  mmkit?: Partial<IMmkitServerActorSettings>;
};

export const DEFAULT_MMKIT_SERVER_LAUNCH: IMmkitServerLaunchSettings = {
  executablePath: "cbserver",
  devCommand: "",
  autoStartup: true,
  extraArgs: [],
};

export const DEFAULT_MMKIT_SERVER_NETWORK: IMmkitServerNetworkSettings = {
  port: 0,
  portProbeMaxAttempts: 10,
  portProbeIntervalMs: 200,
  portProbeConnectTimeoutMs: 250,
};

export const DEFAULT_MMKIT_SERVER_PATHS: IMmkitServerPathSettings = {
  dataDir: "~/.mmkit",
  updateMode: "persistent",
  databasePath: "",
  databaseAllPath: "",
  newDatabasePath: "",
  resetOnStart: false,
  tmpDir: "",
  loadDir: "",
  saveDir: "",
  viewsDir: "",
};

export const DEFAULT_MMKIT_SERVER_RUNTIME: IMmkitServerRuntimeSettings = {
  traceMode: "no",
  untellMode: "cleanup",
  cacheMode: "keep",
  cacheSize: 60_000,
  optimizerMode: 4,
  viewsMaintenance: "off",
  restartDelaySeconds: undefined,
  securityLevel: 1,
  maxErrors: 20,
  adminUser: "",
  multiUser: "enabled",
  moduleSeparator: "-",
  moduleGeneration: "split",
  ccMode: "strict",
  maxCost: 100,
  pathLength: 5,
  iterMax: 3,
  ecaMode: "safe",
  ecaOptimizer: "on",
  ruleLabels: "on",
  inactivityHours: 2,
  serverMode: "master",
  stratificationMode: "on",
  devCommand: undefined,
};

export const DEFAULT_MMKIT_SERVER_MMKIT: IMmkitServerActorSettings = {
  killGraceMs: 5_000,
  clientToolName: "mmkit-server",
  clientUserName: "mmkit",
};

/** Resolved subprocess argv/env produced by {@link buildLaunchRequest}. */
export interface IMmkitServerLaunchRequest {
  executablePath: string;
  args: readonly string[];
  cwd?: string;
  env: NodeJS.ProcessEnv;
}

function trimPath(value: string): string | undefined {
  const trimmed = value.trim();
  if (trimmed === "") {
    return undefined;
  }
  if (trimmed === "~" || trimmed === "~/") {
    return homedir();
  }
  if (trimmed.startsWith("~/")) {
    return path.join(homedir(), trimmed.slice(2));
  }
  return trimmed;
}

function resolveUnderDataDir(value: string, dataDir: string | undefined, suffix: string): string | undefined {
  const explicit = trimPath(value);
  if (explicit !== undefined) {
    return explicit;
  }
  if (dataDir === undefined) {
    return undefined;
  }
  return path.join(dataDir, suffix);
}

function setEnvIfNonEmpty(env: NodeJS.ProcessEnv, key: string, value: string | number | boolean | undefined): void {
  if (value === undefined || value === null) {
    return;
  }
  if (typeof value === "string" && value === "") {
    return;
  }
  env[key] = String(value);
}

/**
 * Build a cbserver subprocess launch spec from {@link MmkitServerConfig}.
 *
 * Path fields expand `~`; empty `paths.*` entries derive from `dataDir` per `CONFIGURATION.md`.
 */
export function buildLaunchRequest(config: IMmkitServerConfig): IMmkitServerLaunchRequest {
  const useNetwork = config.network.port > 0;
  const dataDir = trimPath(config.paths.dataDir);
  const tmpDir = resolveUnderDataDir(config.paths.tmpDir, dataDir, "tmp");
  const newDatabasePath = trimPath(config.paths.newDatabasePath);
  const databasePath = trimPath(config.paths.databasePath);
  let databaseAllPath = trimPath(config.paths.databaseAllPath);
  if (newDatabasePath === undefined && databasePath === undefined && databaseAllPath === undefined
    && dataDir !== undefined && config.paths.updateMode === "persistent") {
    databaseAllPath = path.join(dataDir, "workspace");
  }
  const loadDir = trimPath(config.paths.loadDir);
  const saveDir = trimPath(config.paths.saveDir);
  const viewsDir = trimPath(config.paths.viewsDir);
  const devCommand = config.launch.devCommand.trim();
  const executablePath = devCommand !== "" ? devCommand : config.launch.executablePath;

  const env: NodeJS.ProcessEnv = { ...process.env };
  setEnvIfNonEmpty(env, "TMPDIR", tmpDir);
  if (useNetwork) {
    setEnvIfNonEmpty(env, "CB_PORTNR", config.network.port);
  } else {
    delete env.CB_PORTNR;
  }
  setEnvIfNonEmpty(env, "CB_UPDATE_MODE", config.paths.updateMode);
  if (newDatabasePath !== undefined) {
    env.CB_NEW_DATABASE = newDatabasePath;
  } else if (databaseAllPath !== undefined) {
    env.CB_DB_ALL = databaseAllPath;
  } else if (databasePath !== undefined) {
    env.CB_DATABASE = databasePath;
    if (config.paths.resetOnStart) {
      env.CB_RESET_ON_START = "1";
    }
  }
  setEnvIfNonEmpty(env, "CB_LOAD_DIR", loadDir);
  setEnvIfNonEmpty(env, "CB_SAVE_DIR", saveDir);
  setEnvIfNonEmpty(env, "CB_VIEWS_DIR", viewsDir);
  setEnvIfNonEmpty(env, "CB_TRACEMODE", config.runtime.traceMode);
  setEnvIfNonEmpty(env, "CB_UNTELL_MODE", config.runtime.untellMode);
  setEnvIfNonEmpty(env, "CB_CACHE_MODE", config.runtime.cacheMode);
  setEnvIfNonEmpty(env, "CB_CACHE_SIZE", config.runtime.cacheSize);
  setEnvIfNonEmpty(env, "CB_OPT_MODE", config.runtime.optimizerMode);
  setEnvIfNonEmpty(env, "CB_VIEWS_MAINT", config.runtime.viewsMaintenance);
  setEnvIfNonEmpty(env, "CB_RESTART_SECS", config.runtime.restartDelaySeconds);
  setEnvIfNonEmpty(env, "CB_SECURITY_LEVEL", config.runtime.securityLevel);
  setEnvIfNonEmpty(env, "CB_MAX_ERRORS", config.runtime.maxErrors);
  setEnvIfNonEmpty(env, "CB_ADMIN_USER", config.runtime.adminUser);
  if (config.runtime.multiUser === "enabled") {
    env.CB_MULTI_USER = "1";
  }
  setEnvIfNonEmpty(env, "CB_MODULE_SEPARATOR", config.runtime.moduleSeparator);
  setEnvIfNonEmpty(env, "CB_MODULE_GENERATION", config.runtime.moduleGeneration);
  setEnvIfNonEmpty(env, "CB_CC_MODE", config.runtime.ccMode);
  setEnvIfNonEmpty(env, "CB_MAX_COST", config.runtime.maxCost);
  setEnvIfNonEmpty(env, "CB_PATH_LENGTH", config.runtime.pathLength);
  setEnvIfNonEmpty(env, "CB_ITER_MAX", config.runtime.iterMax);
  setEnvIfNonEmpty(env, "CB_ECA_MODE", config.runtime.ecaMode);
  setEnvIfNonEmpty(env, "CB_ECA_OPTIMIZER", config.runtime.ecaOptimizer);
  setEnvIfNonEmpty(env, "CB_RULE_LABELS", config.runtime.ruleLabels);
  setEnvIfNonEmpty(env, "CB_INACTIVITY_HOURS", config.runtime.inactivityHours);
  setEnvIfNonEmpty(env, "MMKIT_SERVER_MODE", config.runtime.serverMode);
  setEnvIfNonEmpty(env, "CB_STRATIFICATION_MODE", config.runtime.stratificationMode);
  setEnvIfNonEmpty(env, "CB_DEV_CMD", config.runtime.devCommand);
  if (config.mmkit.clientUserName !== "") {
    env.USER = config.mmkit.clientUserName;
    env.LOGNAME = config.mmkit.clientUserName;
  }

  const args: string[] = [...config.launch.extraArgs];
  if (newDatabasePath !== undefined) {
    args.push("-new", newDatabasePath);
  } else if (databaseAllPath !== undefined) {
    args.push("-db", databaseAllPath);
  } else if (databasePath !== undefined) {
    args.push(config.paths.resetOnStart ? "-new" : "-d", databasePath);
  }
  args.push("-u", config.paths.updateMode);
  if (loadDir !== undefined) {
    args.push("-load", loadDir);
  }
  if (saveDir !== undefined) {
    args.push("-save", saveDir);
  }
  if (viewsDir !== undefined) {
    args.push("-views", viewsDir);
  }
  if (useNetwork) {
    args.push("-p", String(config.network.port));
  }
  if (config.runtime.devCommand !== undefined) {
    args.push("-g", config.runtime.devCommand);
  }
  if (config.runtime.adminUser !== "") {
    args.push("-a", config.runtime.adminUser);
  }
  // View-maintenance rule generation (`-v on`) must be a CLI flag: the cbserver
  // binary parses it via startCBserver `Option('-v', …)` and ignores the
  // `CB_VIEWS_MAINT` env var (that var is only honoured by the container
  // entrypoint). Without `-v on`, `vm_<id>` query structs are never built, so
  // every NOTIFICATION_REQUEST view-maintenance registration fails (error/no).
  if (config.runtime.viewsMaintenance !== undefined) {
    args.push("-v", config.runtime.viewsMaintenance);
  }

  return {
    executablePath,
    args,
    cwd: dataDir,
    env,
  };
}

/**
 * Canonical cbserver configuration passed from the extension to {@link @mmkit/server}.
 *
 * Groups:
 * - {@link IMmkitServerLaunchSettings launch} — binary and argv
 * - {@link IMmkitServerNetworkSettings network} — TCP port
 * - {@link IMmkitServerPathSettings paths} — data directories and persistency
 * - {@link IMmkitServerRuntimeSettings runtime} — cbserver behaviour flags
 * - {@link IMmkitServerActorSettings mmkit} — mmkit actor IPC and shutdown timing
 */
export interface IMmkitServerConfig {
  launch: IMmkitServerLaunchSettings;
  network: IMmkitServerNetworkSettings;
  paths: IMmkitServerPathSettings;
  runtime: IMmkitServerRuntimeSettings;
  mmkit: IMmkitServerActorSettings;
}

/**
 * Persistent cbserver launch and runtime configuration.
 */
export class MmkitServerConfig implements IMmkitServerConfig {
  launch: IMmkitServerLaunchSettings = { ...DEFAULT_MMKIT_SERVER_LAUNCH };
  network: IMmkitServerNetworkSettings = { ...DEFAULT_MMKIT_SERVER_NETWORK };
  paths: IMmkitServerPathSettings = { ...DEFAULT_MMKIT_SERVER_PATHS };
  runtime: IMmkitServerRuntimeSettings = { ...DEFAULT_MMKIT_SERVER_RUNTIME };
  mmkit: IMmkitServerActorSettings = { ...DEFAULT_MMKIT_SERVER_MMKIT };

  constructor(init?: MmkitServerConfigInit) {
    if (!init) {
      return;
    }
    if (init.launch) {
      Object.assign(this.launch, init.launch);
    }
    if (init.network) {
      Object.assign(this.network, init.network);
    }
    if (init.paths) {
      Object.assign(this.paths, init.paths);
    }
    if (init.runtime) {
      Object.assign(this.runtime, init.runtime);
    }
    if (init.mmkit) {
      Object.assign(this.mmkit, init.mmkit);
    }
  }

  static fromEnv(): MmkitServerConfig {
    return new MmkitServerConfig( { launch: { executablePath: process.env.MMKIT_CBSERVER_BIN ?? DEFAULT_MMKIT_SERVER_LAUNCH.executablePath, }, mmkit: { killGraceMs: Number(process.env.MMKIT_KILL_GRACE_MS ?? String(DEFAULT_MMKIT_SERVER_MMKIT.killGraceMs)), clientToolName: process.env.MMKIT_CLIENT_TOOL ?? DEFAULT_MMKIT_SERVER_MMKIT.clientToolName, clientUserName: process.env.MMKIT_CLIENT_USER ?? DEFAULT_MMKIT_SERVER_MMKIT.clientUserName, }, } );
  }
}
