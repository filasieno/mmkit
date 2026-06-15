i owndocument note# mmkit — VS Code configuration reference

Canonical setting IDs for `package.json` → `contributes.configuration` and for
`ConfigActor` → `ConfigSnapshot` mapping.

**See also:** [DESIGN.md](./DESIGN.md) §4 (architecture), §4.4 (hot/warm/cold).

---

## Naming conventions

| Rule | Example |
| ---- | ------- |
| Prefix with extension id | `mmkit.` |
| **camelCase** segments, dot-separated hierarchy | `mmkit.server.databasePath` |
| Category = Settings UI submenu (`configuration` array `title`) | `Server`, `Client` |
| **No** `CB_*` env names in setting ids — map in `ConfigSnapshot.toEnv()` | `port` → `CB_PORTNR` |
| **No** redundant words in category titles | ✔ `Server` — ❌ `Server Configuration Settings` |
| Unique ids; no id is a prefix of another | ✔ `server.port` + `server.portProbeTimeout` — ❌ `server` + `server.port` |
| Optional empty string = unset | use `""` default; omit from launch env |
| Workspace scope default | `"scope": "resource"` (folder-overridable) |

### Categories (`contributes.configuration` array)

| `order` | `title` | Setting prefix | Settings UI role |
| ------- | ------- | -------------- | ---------------- |
| 0 | Metamodelling Kit | `mmkit.operationalMode` | Default category (same as display name) |
| 1 | Server | `mmkit.server.*` | Internal cbserver mode |
| 2 | Client | `mmkit.client.*` | Remote TCP client mode |

### Property sheet webview

The custom property sheet **mirrors** these ids (same labels and descriptions).
It reads/writes via `workspace.getConfiguration('mmkit')` — not a parallel schema.

### Change class (data metadata, not a VS Code field)

Each setting has `changeClass` in `config-schema.ts`: `hot` | `warm` | `cold`.
Used by `ConfigActor` to emit `configRequiresRestart` vs internal update.

### Home data directory (`~/.mmkit`)

Internal server mutable state defaults under the user home directory, not the
workspace folder and not `/tmp/cbserver`.

| Path | Source | Purpose |
| ---- | ------ | ------- |
| `~/.mmkit` | `mmkit.server.dataDir` | Root for all mmkit-owned cbserver data |
| `~/.mmkit/workspace` | derived when `databaseAllPath` empty | `CB_DB_ALL` — database + module save + views (Containerfile pattern E) |
| `~/.mmkit/tmp` | derived when `tmpDir` empty | `TMPDIR` — nonpersistent session copies |

`ConfigActor` expands a leading `~` with `os.homedir()`, creates missing
directories via `FsPort` during `Loading`, then builds `ConfigSnapshot` with
**resolved absolute paths**. Workspace-scoped settings may override any path for
per-project databases.

---

## ConfigActor — per field?

**No** per-field HSM. One **`ConfigActor`** (see DESIGN.md §11) owns configuration
lifecycle: load → debounce → validate → `snapshotPublished@vN`.

| Layer | Responsibility |
| ----- | -------------- |
| **`config-schema.ts`** | Per-field metadata (not actors): `changeClass`, validators, env map, UI text |
| **`VscodeConfigPort`** | `readConfiguration` / `executeUpdate` — pull and command, not push |
| **`ConfigActor` HSM** | States: `Inactive` → `Loading` → `Ready` (`Valid`/`Invalid`/`Editing`) → `ShuttingDown` |
| **`PluginCoordinator`** | Sole listener for `onDidChangeConfiguration`; forwards `reloadFromHost` |

Flow: host change → `PluginCoordinator` → `ConfigActor.reloadFromHost` → read port →
validate → `snapshotPublished` → coordinator applies mode + forwards to managers.

Optional: stateless **`FieldPresenter`** for webview layout only.

---

## General

### `mmkit.operationalMode`

| | |
| --- | --- |
| **Title** | Operational mode |
| **Type** | `string` enum |
| **Default** | `none` |
| **Scope** | `resource` |
| **Change class** | `cold` |
| **Enum** | `none`, `internalServer`, `client` |

**Description:** Whether mmkit manages a local cbserver, connects as a TCP client, or stays idle.

**markdownDescription (tooltip / detail):**

Controls which state machines are active.

- **none** — `ServerManager` and `ClientManager` remain disabled.
- **internalServer** — mmkit starts and supervises a cbserver (executable or Docker) using **Server** settings.
- **client** — mmkit connects to an existing cbserver over TCP using **Client** settings.

Switching mode triggers a coordinated shutdown via `PluginCoordinator` before enabling the other side.

---

## Server — launch

### `mmkit.server.autoStartup`

| | |
| --- | --- |
| **Title** | Auto-start server |
| **Type** | `boolean` |
| **Default** | `false` |
| **Change class** | `hot` |

**Description:** Start the internal cbserver automatically when the workspace opens and configuration is valid.

**markdownDescription:** When enabled and `operationalMode` is `internalServer`, `ServerManager` receives `userStartServer` after `ConfigActor` emits a valid snapshot. Disable for manual control from the command palette or status bar.

---

### `mmkit.server.launchKind`

| | |
| --- | --- |
| **Title** | Launch method |
| **Type** | `string` enum: `executable`, `docker` |
| **Default** | `executable` |
| **Change class** | `cold` |

**Description:** Run cbserver as a local binary or inside a Docker container.

**markdownDescription:** **executable** — spawn `mmkit.server.executablePath` as a child process with environment derived from server settings. **docker** — run `docker run` with `mmkit.server.dockerImage`; port publishing is added automatically from `mmkit.server.port`.

---

### `mmkit.server.executablePath`

| | |
| --- | --- |
| **Title** | cbserver executable path |
| **Type** | `string` |
| **Default** | `cbserver` |
| **Change class** | `warm` |

**Description:** Path to the `cbserver` binary when launch method is **executable**.

**markdownDescription:** Absolute path or name resolved via `PATH`. On Linux dev machines this is often the Nix-built binary (`nix build .#cbserver`). Changing this while the server is running requires a restart.

---

### `mmkit.server.dockerImage`

| | |
| --- | --- |
| **Title** | Docker image |
| **Type** | `string` |
| **Default** | `conceptbase-cbserver:0.1.1` |
| **Change class** | `warm` |
| **Maps to** | `docker run` image argument |

**Description:** Container image reference for Docker launch.

**markdownDescription:** Built from `components/cbserver/container/Containerfile`. Environment variables for cbserver are passed with `docker run -e`. Image must be pullable on the host.

---

### `mmkit.server.dockerContainerName`

| | |
| --- | --- |
| **Title** | Docker container name |
| **Type** | `string` |
| **Default** | `mmkit-cbserver` |
| **Change class** | `warm` |

**Description:** Fixed name for the cbserver container (`docker run --name`).

**markdownDescription:** Helps identify and remove orphaned containers during reconciliation. Leave default unless multiple instances per host are required.

---

### `mmkit.server.dockerExtraRunArgs`

| | |
| --- | --- |
| **Title** | Extra Docker run arguments |
| **Type** | `array` of `string` |
| **Default** | `[]` |
| **Change class** | `warm` |

**Description:** Additional arguments passed to `docker run` (volumes, binds, etc.).

**markdownDescription:** Port mapping `-p host:container` is injected automatically from `mmkit.server.port`. When empty, Docker launch bind-mounts `mmkit.server.dataDir/workspace` to `/data/workspace` and sets `CB_DB_ALL=/data/workspace` in the container. Add extra `-v` flags here only for additional mounts.

---

## Server — data directory

### `mmkit.server.dataDir`

| | |
| --- | --- |
| **Title** | Data directory |
| **Type** | `string` |
| **Default** | `~/.mmkit` |
| **Change class** | `warm` |
| **Scope** | `application` |

**Description:** Base directory in the user home folder for internal cbserver data.

**markdownDescription:** All mmkit-managed disk state for the internal server lives under this directory unless a more specific path setting overrides it. A leading `~` is expanded to the OS home directory (`$HOME` on Linux/macOS, `%USERPROFILE%` on Windows with WSL paths as configured).

Default layout created on first start:

```
~/.mmkit/
  workspace/     ← database, module listings, views (flag -db)
  tmp/             ← nonpersistent session copies (TMPDIR)
```

Changing `dataDir` while the server is running requires a restart. Per-workspace
overrides of `databaseAllPath` or `databasePath` are still allowed without
moving `dataDir`.

---

## Server — install paths

### `mmkit.server.cbHome`

| | |
| --- | --- |
| **Title** | CB_HOME install root |
| **Type** | `string` |
| **Default** | `/opt/conceptbase` |
| **Change class** | `warm` |
| **Maps to** | `CB_HOME` |

**Description:** Read-only ConceptBase installation directory.

**markdownDescription:** Root of the cbserver install tree. In the official container image this is `/opt/conceptbase`. Override only when using a custom install layout.

---

### `mmkit.server.cbPool`

| | |
| --- | --- |
| **Title** | CB_POOL directory |
| **Type** | `string` |
| **Default** | `/opt/conceptbase/share` |
| **Change class** | `warm` |
| **Maps to** | `CB_POOL` |

**Description:** ConceptBase pool (shared resources) directory.

**markdownDescription:** Defaults to `$CB_HOME/share`. Rarely changed except in custom deployments.

---

### `mmkit.server.cbsDir`

| | |
| --- | --- |
| **Title** | Server Prolog sources (CBS_DIR) |
| **Type** | `string` |
| **Default** | `/opt/conceptbase/share/serverSources/Prolog_Files` |
| **Change class** | `warm` |
| **Maps to** | `CBS_DIR` |

**Description:** Directory containing server-side Prolog sources.

**markdownDescription:** Maps to flag environment `CBS_DIR`. Part of the read-only install tree unless bind-mounted.

---

### `mmkit.server.cblDir`

| | |
| --- | --- |
| **Title** | System data directory (CBL_DIR) |
| **Type** | `string` |
| **Default** | `/opt/conceptbase/share/system-data` |
| **Change class** | `warm` |
| **Maps to** | `CBL_DIR` |

**Description:** ConceptBase system data directory.

**markdownDescription:** Maps to `CBL_DIR`. Contains built-in system modules and data shipped with the installation.

---

### `mmkit.server.prologVariant`

| | |
| --- | --- |
| **Title** | Prolog engine variant |
| **Type** | `string` |
| **Default** | `SWI` |
| **Change class** | `warm` |
| **Maps to** | `PROLOG_VARIANT` |

**Description:** Prolog implementation used by cbserver.

**markdownDescription:** Default is SWI-Prolog. Change only when using a build compiled for another engine.

---

### `mmkit.server.cbVariant`

| | |
| --- | --- |
| **Title** | Build variant |
| **Type** | `string` |
| **Default** | `""` |
| **Change class** | `warm` |
| **Maps to** | `CB_VARIANT` |

**Description:** Optional ConceptBase build variant identifier.

**markdownDescription:** Leave empty unless your distribution sets `CB_VARIANT` for specialised builds.

---

## Server — network

### `mmkit.server.port`

| | |
| --- | --- |
| **Title** | TCP port |
| **Type** | `number` |
| **Default** | `4001` |
| **Minimum** | `2000` |
| **Maximum** | `65535` |
| **Change class** | `warm` |
| **Maps to** | `CB_PORTNR` / `-p` |

**Description:** TCP port for client connections to cbserver.

**markdownDescription:** Must be between 2000 and 65535. If another process holds the port, startup fails with a port conflict fault. Default **4001** matches CBShell and the container `EXPOSE`. Clients connect with `mmkit.client.host` and `mmkit.client.port`.

---

## Server — database and directories

### `mmkit.server.updateMode`

| | |
| --- | --- |
| **Title** | Update persistency |
| **Type** | `string` enum: `persistent`, `nonpersistent` |
| **Default** | `persistent` |
| **Change class** | `warm` |
| **Maps to** | `CB_UPDATE_MODE` / `-u` |

**Description:** Whether tell/untell changes survive a server restart.

**markdownDescription:**

- **persistent** (default) — updates stored under `~/.mmkit/workspace` and kept across sessions (Containerfile pattern C/E).
- **nonpersistent** — updates are lost when cbserver stops; session work copies use `mmkit.server.tmpDir` (`~/.mmkit/tmp` by default).

Pair **nonpersistent** with an empty `databaseAllPath` only for fully ephemeral sessions.

---

### `mmkit.server.databasePath`

| | |
| --- | --- |
| **Title** | Database directory |
| **Type** | `string` |
| **Default** | `""` |
| **Change class** | `warm` |
| **Maps to** | `CB_DATABASE` / `-d` |

**Description:** Primary knowledge-base directory (database only).

**markdownDescription:** Directory holding `OB.telos`, `OB.symbol`, `OB.rule`, and related files. Created if missing. Two servers must not use the same directory concurrently (`OB.lock`). Mutually exclusive with `databaseAllPath` and `newDatabasePath` (first match wins in entrypoint). Empty = use `databaseAllPath` derived from `dataDir` (`~/.mmkit/workspace`); if that is also unset and `updateMode` is `nonpersistent`, no `-d` flag (ephemeral bootstrap).

---

### `mmkit.server.databaseAllPath`

| | |
| --- | --- |
| **Title** | Combined workspace directory (-db) |
| **Type** | `string` |
| **Default** | `""` |
| **Change class** | `warm` |
| **Maps to** | `CB_DB_ALL` / `-db` |

**Description:** Single directory for database, module save, and views (flag `-db`).

**markdownDescription:** Like `-d` but also sets load/save/views to the same path. Containerfile **pattern E**. Takes precedence over `databasePath` when set. Empty = **`${dataDir}/workspace`** (default `~/.mmkit/workspace`).

---

### `mmkit.server.newDatabasePath`

| | |
| --- | --- |
| **Title** | New database path (-new) |
| **Type** | `string` |
| **Default** | `""` |
| **Change class** | `warm` |
| **Maps to** | `CB_NEW_DATABASE` / `-new` |

**Description:** Erase any existing database at this path, then create a fresh one.

**markdownDescription:** **Destructive.** Highest priority among database path settings. Use for intentional wipes. Containerfile **pattern D** combines persistent volume with `resetOnStart` instead.

---

### `mmkit.server.resetOnStart`

| | |
| --- | --- |
| **Title** | Reset database on each start |
| **Type** | `boolean` |
| **Default** | `false` |
| **Change class** | `warm` |
| **Maps to** | `CB_RESET_ON_START` |

**Description:** With `databasePath` set, use `-new` instead of `-d` on every start.

**markdownDescription:** Wipes and recreates the database at `databasePath` each time the server starts (pattern D). Ignored when `newDatabasePath` is set.

---

### `mmkit.server.tmpDir`

| | |
| --- | --- |
| **Title** | Temporary session directory |
| **Type** | `string` |
| **Default** | `""` (resolved to `~/.mmkit/tmp`) |
| **Change class** | `warm` |
| **Maps to** | `TMPDIR` |

**Description:** Parent directory for nonpersistent per-session database copies.

**markdownDescription:** Used when `updateMode` is `nonpersistent` and a seed database is configured. Each session gets `$TMPDIR/<user>_<unique>_<pid>/`. Removed on exit. Empty = **`${dataDir}/tmp`**. The official container image uses `/tmp/cbserver` inside the container; Docker launch maps host `~/.mmkit/tmp` when needed.

---

### `mmkit.server.loadDir`

| | |
| --- | --- |
| **Title** | Module load directory |
| **Type** | `string` |
| **Default** | `""` |
| **Change class** | `warm` |
| **Maps to** | `CB_LOAD_DIR` / `-load` |

**Description:** Directory of `*.sml` module sources loaded at startup.

**markdownDescription:** Read-only at startup. Empty = no modules loaded from disk (default `none` in user manual).

---

### `mmkit.server.saveDir`

| | |
| --- | --- |
| **Title** | Module save directory |
| **Type** | `string` |
| **Default** | `""` |
| **Change class** | `warm` |
| **Maps to** | `CB_SAVE_DIR` / `-save` |

**Description:** Directory where module listings (`*.sml`) are written on shutdown or client logout.

**markdownDescription:** Directory must exist. Empty disables saving. See user manual section on module sources.

---

### `mmkit.server.viewsDir`

| | |
| --- | --- |
| **Title** | Views directory |
| **Type** | `string` |
| **Default** | `""` |
| **Change class** | `warm` |
| **Maps to** | `CB_VIEWS_DIR` / `-views` |

**Description:** Directory for materialized query results (views).

**markdownDescription:** Empty disables view materialization. See user manual `sec:module_views`.

---

## Server — runtime behaviour

### `mmkit.server.traceMode`

| | |
| --- | --- |
| **Title** | Trace mode |
| **Type** | `string` enum |
| **Default** | `no` |
| **Change class** | `hot` |
| **Maps to** | `CB_TRACEMODE` / `-t` |

**Enum:** `silent`, `no`, `minimal`, `low`, `high`, `veryhigh`

**Description:** How much diagnostic output cbserver writes during execution.

**markdownDescription:** Does not change functional behaviour; used for debugging. `no` shows the CBserver interface only; `silent` suppresses even the “CBserver ready” line (mmkit uses port probe as readiness source). `high` / `veryhigh` trap fatal signals for interactive diagnosis.

---

### `mmkit.server.untellMode`

| | |
| --- | --- |
| **Title** | Untell mode |
| **Type** | `string` enum: `verbatim`, `cleanup` |
| **Default** | `cleanup` |
| **Change class** | `warm` |
| **Maps to** | `CB_UNTELL_MODE` / `-U` |

**Description:** How UNTELL removes objects from the database.

**markdownDescription:** **cleanup** (default) also removes `Individual` / `Attribute` instantiation like an inverse TELL. **verbatim** only removes facts in the submitted frame.

---

### `mmkit.server.cacheMode`

| | |
| --- | --- |
| **Title** | Query cache mode |
| **Type** | `string` enum: `off`, `transient`, `keep` |
| **Default** | `keep` |
| **Change class** | `warm` |
| **Maps to** | `CB_CACHE_MODE` / `-c` |

**Description:** Enables recursive query evaluation cache.

**markdownDescription:** **transient** clears cache each transaction; **keep** retains entries until invalidation or size limit (`cacheSize`).

---

### `mmkit.server.cacheSize`

| | |
| --- | --- |
| **Title** | Query cache size |
| **Type** | `number` |
| **Default** | `60000` |
| **Change class** | `warm` |
| **Maps to** | `CB_CACHE_SIZE` / `-cs` |

**Description:** Maximum derived facts kept in the query cache between transactions.

**markdownDescription:** Applies when `cacheMode` is `keep`. Default 60000 facts.

---

### `mmkit.server.optimizerMode`

| | |
| --- | --- |
| **Title** | Optimizer mode |
| **Type** | `number` enum: `0`, `1`, `2`, `3`, `4` |
| **Default** | `4` |
| **Change class** | `warm` |
| **Maps to** | `CB_OPT_MODE` / `-o` |

**Description:** Rule, constraint, and query optimizer level (0–4).

**markdownDescription:** `0` = none; `4` = structural + join order + trigger pruning (recommended default).

---

### `mmkit.server.viewsMaintenance`

| | |
| --- | --- |
| **Title** | View maintenance rules |
| **Type** | `string` enum: `on`, `off` |
| **Default** | `off` |
| **Change class** | `warm` |
| **Maps to** | `CB_VIEWS_MAINT` / `-v` |

**Description:** Generate rules that keep materialized views up to date on updates.

**markdownDescription:** Default **off**. Enable when using views with ongoing tell/untell activity.

---

### `mmkit.server.restartDelaySeconds`

| | |
| --- | --- |
| **Title** | Auto-restart delay (seconds) |
| **Type** | `number` |
| **Default** | `0` (unset) |
| **Change class** | `warm` |
| **Maps to** | `CB_RESTART_SECS` / `-r` |

**Description:** Seconds to wait before restarting cbserver after a crash.

**markdownDescription:** `0` or empty disables auto-restart. Use with care — can loop on corrupted databases. mmkit also caps consecutive restarts (`maxRestartAttempts` in schema, internal).

---

### `mmkit.server.securityLevel`

| | |
| --- | --- |
| **Title** | Security level |
| **Type** | `number` enum: `0`, `1`, `2`, `3` |
| **Default** | `1` |
| **Change class** | `warm` |
| **Maps to** | `CB_SECURITY_LEVEL` / `-s` |

**Description:** ConceptBase access control strictness (0 = none, 3 = read-mostly).

**markdownDescription:** Level **1** prevents untelling objects outside the current module. Level **2** enforces permission rules. Enable **2** or **3** in multi-user deployments.

---

### `mmkit.server.maxErrors`

| | |
| --- | --- |
| **Title** | Max errors per transaction |
| **Type** | `number` |
| **Default** | `20` |
| **Change class** | `warm` |
| **Maps to** | `CB_MAX_ERRORS` / `-e` |

**Description:** Cap on error messages sent to a client in one transaction.

**markdownDescription:** `-1` = unlimited; `0` = suppress all error messages.

---

### `mmkit.server.adminUser`

| | |
| --- | --- |
| **Title** | Administrator user |
| **Type** | `string` |
| **Default** | `""` |
| **Change class** | `warm` |
| **Maps to** | `CB_ADMIN_USER` / `-a` |

**Description:** Extra user allowed to shut down the server.

**markdownDescription:** May include host suffix (`user@host`). The user who started the server retains shutdown rights.

---

### `mmkit.server.multiUser`

| | |
| --- | --- |
| **Title** | Multi-user mode |
| **Type** | `string` enum: `enabled`, `disabled` |
| **Default** | `enabled` |
| **Change class** | `warm` |
| **Maps to** | `CB_MULTIUSER` / `-mu` |

**Description:** Allow multiple distinct user names to connect.

**markdownDescription:** **disabled** restricts connections to the same OS user name (weak protection — use firewalls for real security).

---

### `mmkit.server.moduleSeparator`

| | |
| --- | --- |
| **Title** | Module file separator |
| **Type** | `string` enum: `-`, `/` |
| **Default** | `-` |
| **Change class** | `warm` |
| **Maps to** | `CB_MODULE_SEP` / `-ms` |

**Description:** Flat (`-`) vs nested (`/`) directory layout for saved modules and views.

**markdownDescription:** `/` mirrors the module tree as subdirectories.

---

### `mmkit.server.moduleGeneration`

| | |
| --- | --- |
| **Title** | Module listing generation |
| **Type** | `string` enum: `split`, `whole`, `minsplit` |
| **Default** | `split` |
| **Change class** | `warm` |
| **Maps to** | `CB_MODULE_GEN` / `-mg` |

**Description:** How transaction separators appear in generated `*.sml` listings.

**markdownDescription:** **split** aids meta-formula modules; **minsplit** speeds reload with fewer separators.

---

### `mmkit.server.ccMode`

| | |
| --- | --- |
| **Title** | Predicate typing (CC mode) |
| **Type** | `string` enum: `strict`, `extended`, `off` |
| **Default** | `strict` |
| **Change class** | `warm` |
| **Maps to** | `CB_CC_MODE` / `-cc` |

**Description:** Strictness of attribution predicate typing in queries.

**markdownDescription:** **strict** rejects ambiguous predicates; **extended** searches subclasses; **off** is permissive (rules/constraints still enforced).

---

### `mmkit.server.maxCost`

| | |
| --- | --- |
| **Title** | Meta-formula max cost |
| **Type** | `number` |
| **Default** | `100` |
| **Change class** | `warm` |
| **Maps to** | `CB_MAX_COST` / `-mc` |

**Description:** Maximum cost for predicates on meta-formula binding paths.

**markdownDescription:** Higher values increase compile time and search breadth. Default 100 (~two free variables).

---

### `mmkit.server.pathLength`

| | |
| --- | --- |
| **Title** | Meta-formula path length |
| **Type** | `number` |
| **Default** | `5` |
| **Change class** | `warm` |
| **Maps to** | `CB_PATH_LEN` / `-pl` |

**Description:** Maximum binding path length for meta-formula compilation.

**markdownDescription:** `0` disables meta-formula compilation entirely.

---

### `mmkit.server.iterMax`

| | |
| --- | --- |
| **Title** | Attribution reorder iterations |
| **Type** | `number` |
| **Default** | `3` |
| **Change class** | `warm` |
| **Maps to** | `CB_ITER_MAX` / `-im` |

**Description:** Iterations for reordering single-free-variable attribution predicates.

**markdownDescription:** Can improve query and ECA performance when increased.

---

### `mmkit.server.ecaMode`

| | |
| --- | --- |
| **Title** | ECA mode |
| **Type** | `string` enum: `safe`, `unsafe`, `off` |
| **Default** | `safe` |
| **Change class** | `warm` |
| **Maps to** | `CB_ECA_MODE` / `-eca` |

**Description:** Event-condition-action rule evaluation mode.

**markdownDescription:** **safe** safeguards recursive rules (default). **unsafe** may be faster if no recursive predicates on fresh state. **off** disables ECA entirely.

---

### `mmkit.server.ecaOptimizer`

| | |
| --- | --- |
| **Title** | ECA condition optimizer |
| **Type** | `string` enum: `on`, `off` |
| **Default** | `on` |
| **Change class** | `warm` |
| **Maps to** | `CB_ECA_OPT` / `-eo` |

**Description:** Re-order predicates in ECA rule conditions.

**markdownDescription:** Turn **off** only when manual evaluation order is required.

---

### `mmkit.server.ruleLabels`

| | |
| --- | --- |
| **Title** | Generated formula labels |
| **Type** | `string` enum: `on`, `off` |
| **Default** | `on` |
| **Change class** | `warm` |
| **Maps to** | `CB_RULE_LABELS` / `-rl` |

**Description:** Use readable labels for generated formulas.

**markdownDescription:** **off** uses unique system identifiers (safer against duplicate labels).

---

### `mmkit.server.inactivityHours`

| | |
| --- | --- |
| **Title** | Client inactivity (hours) |
| **Type** | `number` |
| **Default** | `2` |
| **Change class** | `warm` |
| **Maps to** | `CB_INACTIVITY_HOURS` / `-ia` |

**Description:** Hours of client activity required before treating a client as active.

**markdownDescription:** Used with slave mode, restart, or `devCommand` **public**. Negative = infinity.

---

### `mmkit.server.serverMode`

| | |
| --- | --- |
| **Title** | Server mode |
| **Type** | `string` enum: `master`, `slave` |
| **Default** | `master` |
| **Change class** | `warm` |
| **Maps to** | `CB_SERVER_MODE` / `-sm` |

**Description:** Whether the server stays up after the last client disconnects.

**markdownDescription:** **slave** — server may shut down when the last client leaves (same OS user). **master** — requires explicit stop. Bare `cbserver` with no args defaults to slave; mmkit default is master for IDE workflows.

---

### `mmkit.server.stratificationMode`

| | |
| --- | --- |
| **Title** | Stratification test |
| **Type** | `string` enum: `on`, `off` |
| **Default** | `on` |
| **Change class** | `warm` |
| **Maps to** | `CB_STRAT_MODE` / `-st` |

**Description:** Dynamic rule stratification violation checks during query evaluation.

**markdownDescription:** Disable only when confident answers remain correct despite violations.

---

### `mmkit.server.devCommand`

| | |
| --- | --- |
| **Title** | Special startup command |
| **Type** | `string` enum: `""`, `nolpi`, `public`, `exit` |
| **Default** | `""` |
| **Change class** | `warm` |
| **Maps to** | `CB_DEV_CMD` / `-g` |

**Description:** Special `-g` command: ignore plugins, public server, or exit after materialization.

**markdownDescription:** **nolpi** skips `.lpi` plugins; **public** configures a public CBserver; **exit** exits immediately after startup tasks (useful with views/db materialization).

---

### `mmkit.server.extraArgs`

| | |
| --- | --- |
| **Title** | Extra cbserver arguments |
| **Type** | `string` |
| **Default** | `""` |
| **Change class** | `warm` |
| **Maps to** | `CB_EXTRA_ARGS` |

**Description:** Additional command-line tokens appended to the cbserver invocation.

**markdownDescription:** Space-separated passthrough flags not covered by other settings (e.g. `-g nolpi` if not using `devCommand`). Parsed like the container entrypoint.

---

## Client

### `mmkit.client.host`

| | |
| --- | --- |
| **Title** | Server hostname |
| **Type** | `string` |
| **Default** | `localhost` |
| **Change class** | `warm` |

**Description:** Hostname or IP of the cbserver for TCP connection.

**markdownDescription:** Use `localhost` when connecting to `mmkit.server` on the same machine. Remote hosts require network reachability on `mmkit.client.port`.

---

### `mmkit.client.port`

| | |
| --- | --- |
| **Title** | Server port |
| **Type** | `number` |
| **Default** | `4001` |
| **Change class** | `warm` |

**Description:** TCP port of the remote cbserver.

**markdownDescription:** Must match the server's listening port (`mmkit.server.port` for local internal server).

---

### `mmkit.client.toolName`

| | |
| --- | --- |
| **Title** | Client tool name |
| **Type** | `string` |
| **Default** | `mmkit` |
| **Change class** | `hot` (before connect) |

**Description:** Tool name sent in the `ENROLL_ME` handshake.

**markdownDescription:** Identifies this client to the server (like `CBShell` or `ModelerXY` in the user manual). Cannot change while connected without reconnecting.

---

### `mmkit.client.userName`

| | |
| --- | --- |
| **Title** | User name |
| **Type** | `string` |
| **Default** | `""` |
| **Change class** | `hot` (before connect) |

**Description:** User name for server enrollment.

**markdownDescription:** Empty uses the OS login name of the user running VS Code. Affects multi-user access control on the server.

---

### `mmkit.client.connectTimeoutMs`

| | |
| --- | --- |
| **Title** | Connect timeout (ms) |
| **Type** | `number` |
| **Default** | `30000` |
| **Change class** | `hot` |

**Description:** Maximum time to establish TCP connection and complete enrollment.

**markdownDescription:** Applies to `ClientManager.Connecting`. On timeout → `Faulted.ConnectionRefused` or enrollment fault.

---

### `mmkit.client.autoConnect`

| | |
| --- | --- |
| **Title** | Auto-connect |
| **Type** | `boolean` |
| **Default** | `false` |
| **Change class** | `hot` |

**Description:** Connect automatically when client mode is enabled and configuration is valid.

**markdownDescription:** Analogous to `mmkit.server.autoStartup` for the client path.

---

### `mmkit.client.autoReconnect`

| | |
| --- | --- |
| **Title** | Auto-reconnect |
| **Type** | `boolean` |
| **Default** | `true` |
| **Change class** | `hot` |

**Description:** Reconnect with backoff after an unexpected connection loss.

**markdownDescription:** When **false**, socket close returns `ClientManager` to `Idle` without retry.

---

### `mmkit.client.reconnectBackoffMs`

| | |
| --- | --- |
| **Title** | Reconnect backoff (ms) |
| **Type** | `array` of `number` |
| **Default** | `[1000, 2000, 5000, 10000]` |
| **Change class** | `hot` |

**Description:** Delay schedule between reconnect attempts.

**markdownDescription:** Each entry is a wait in milliseconds. After the last value, the last delay repeats. Cancelled on manual disconnect or mode change.

---

## package.json fragment (structure)

```jsonc
"contributes": {
  "configuration": [
    {
      "title": "Metamodelling Kit",
      "order": 0,
      "properties": {
        "mmkit.operationalMode": {
          "type": "string",
          "enum": ["none", "internalServer", "client"],
          "enumDescriptions": [
            "Do not manage a server or client connection.",
            "Start and supervise a local cbserver.",
            "Connect to an existing cbserver over TCP."
          ],
          "default": "none",
          "scope": "resource",
          "order": 0,
          "title": "Operational mode",
          "description": "Whether mmkit manages a local cbserver, connects as a TCP client, or stays idle.",
          "markdownDescription": "See [mmkit documentation](https://gitlab.com/mjeu/conceptbasecc) for mode switching behaviour."
        }
      }
    },
    {
      "title": "Server",
      "order": 1,
      "properties": {
        "mmkit.server.autoStartup": { }
        // … remaining mmkit.server.* — copy description + markdownDescription from this file
      }
    },
    {
      "title": "Client",
      "order": 2,
      "properties": {
        "mmkit.client.host": { }
        // … remaining mmkit.client.*
      }
    }
  ]
}
```

Use `"markdownDescription"` for tooltip/detail text; `"description"` for the compact line in the settings list. VS Code renders `markdownDescription` in the settings detail pane and on hover where supported.

---

## Env mapping reference (`ConfigSnapshot.toEnv()`)

| Setting id | Environment variable |
| ----------- | --------------------- |
| `mmkit.server.dataDir` | *(mmkit only — paths derived before env build)* |
| `mmkit.server.port` | `CB_PORTNR` |
| `mmkit.server.updateMode` | `CB_UPDATE_MODE` |
| `mmkit.server.databasePath` | `CB_DATABASE` |
| `mmkit.server.databaseAllPath` | `CB_DB_ALL` |
| `mmkit.server.newDatabasePath` | `CB_NEW_DATABASE` |
| `mmkit.server.resetOnStart` | `CB_RESET_ON_START` (`1` / `0`) |
| `mmkit.server.tmpDir` | `TMPDIR` |
| `mmkit.server.loadDir` | `CB_LOAD_DIR` |
| `mmkit.server.saveDir` | `CB_SAVE_DIR` |
| `mmkit.server.viewsDir` | `CB_VIEWS_DIR` |
| `mmkit.server.traceMode` | `CB_TRACEMODE` |
| … | *(see entrypoint.sh for full list)* |

`CB_DB_DIR` is **not** exposed — use `databasePath` only.

---

*End of configuration reference.*
