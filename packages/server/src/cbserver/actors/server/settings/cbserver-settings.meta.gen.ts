// AUTO-GENERATED from cbserver-settings.meta.yaml — do not edit.
// Regenerate: node tools/generate-cbserver-settings-meta.mjs
export const CB_SERVER_SETTINGS_META_DOC = {
  "schemaVersion": 1,
  "model": "CBServerConfig",
  "docRefs": {
    "man": "components/man/man1/cbserver.1",
    "userManual": "components/doc/user-manual/chapters/CBserver.typ#sec:cbsparams",
    "configuration": "docs/CONFIGURATION.md"
  },
  "groups": {
    "launch": {
      "title": "Starting the server",
      "description": "Where cbserver lives and how it is started on your machine.",
      "tooltip": "Executable location, automatic start, and optional extra command-line options.",
      "detailed": "Use these settings when you install ConceptBase.cc locally and want the editor\nor mmkit to start cbserver for you. Most users only need the defaults: cbserver\non your PATH, automatic start enabled, and no extra arguments.\n",
      "order": 1
    },
    "network": {
      "title": "Network",
      "description": "Which TCP port clients use to reach your knowledge base.",
      "tooltip": "Must match the port your CBShell or other clients connect to.",
      "detailed": "Change the port only when 4001 is already in use on your computer, or when\nyour organisation assigns a specific port for ConceptBase services.\n",
      "order": 2
    },
    "paths": {
      "title": "Data and folders",
      "description": "Where your database and module files are stored on disk.",
      "tooltip": "Workspace location, persistency, and optional load/save directories.",
      "detailed": "These settings define **where your work is kept** and **whether changes survive\nafter you close the server**. Choose persistent storage for real projects;\nuse non-persistent mode for quick experiments you do not need to keep.\n\n**Important:** Never point two running servers at the same database folder.\n",
      "order": 3
    },
    "runtime": {
      "title": "Server behaviour",
      "description": "Performance, security, diagnostics, and advanced ConceptBase options.",
      "tooltip": "Query engine, access control, tracing, modules, and lifecycle.",
      "detailed": "Adjust these when you need more diagnostic output, stricter security in a\nshared environment, better query performance, or special server modes\n(e.g. slave server that stops when you disconnect).\n\nLeave defaults unless you have a specific reason to change them.\n",
      "order": 4
    },
    "mmkit": {
      "title": "Editor connection",
      "description": "How the mmkit editor identifies itself and stops the server cleanly.",
      "tooltip": "Your user name on the server and shutdown timing.",
      "detailed": "These settings affect how the editor connects to cbserver and how long the\nserver waits before force-quitting during shutdown. Typical users can keep\nthe defaults.\n",
      "order": 5
    }
  }
} as const;

export const CB_SERVER_SETTING_META = [
  {
    "key": "launch.executablePath",
    "title": "cbserver program",
    "description": "Location of the ConceptBase.cc server program on your computer.",
    "tooltip": "Change only if cbserver is not found automatically or you use a custom install.",
    "detailed": "## cbserver program\n\n**When to use the default (`cbserver`):**  \nConceptBase.cc is installed normally and the `cbserver` command works in a terminal.\n\n**When to set a full path:**  \n- You installed ConceptBase.cc in a non-standard location  \n- Multiple versions exist and you want a specific binary  \n- The editor reports that cbserver cannot be found  \n\nAfter changing this setting, **restart the server** for it to take effect.\n",
    "kind": "string",
    "group": "launch",
    "section": "Starting",
    "order": 10,
    "defaultValue": "cbserver",
    "changeClass": "warm",
    "mapsToCli": "argv[0]",
    "restartRequired": true,
    "placeholder": "cbserver",
    "scope": "application",
    "docRef": "docs/CONFIGURATION.md#mmkitserverexecutablepath",
    "examples": [
      "cbserver",
      "/opt/conceptbase/bin/cbserver"
    ]
  },
  {
    "key": "launch.devCommand",
    "title": "Custom start command",
    "description": "Replace the normal start command with a full command line (advanced).",
    "tooltip": "Leave empty unless support or your administrator gave you a custom command.",
    "detailed": "## Custom start command\n\n**When to leave empty (almost everyone):**  \nNormal daily use — the editor starts cbserver using the program path above.\n\n**When to set a value:**  \n- Your administrator provided a wrapper script  \n- You are diagnosing startup problems under expert guidance  \n- A special install requires a non-standard launch command  \n\nThis is an advanced setting. If unsure, leave it blank.\n",
    "kind": "string",
    "group": "launch",
    "section": "Starting",
    "order": 20,
    "defaultValue": "",
    "changeClass": "cold",
    "optional": true,
    "restartRequired": true,
    "placeholder": "",
    "docRef": "docs/CONFIGURATION.md#mmkitserverdevcommand"
  },
  {
    "key": "launch.autoStartup",
    "title": "Start server automatically",
    "description": "Start cbserver when you open the editor or mmkit-server.",
    "tooltip": "Turn off if you prefer to start cbserver yourself from a terminal.",
    "detailed": "## Start server automatically\n\n**When to enable (default):**  \nYou want a seamless experience — open the editor and your knowledge base is\nready without manual steps.\n\n**When to disable:**  \n- You always start cbserver yourself (e.g. shared machine, scripted workflow)  \n- Another tool already runs cbserver and the editor should only connect  \n- You want to review settings before the server starts  \n\nYou can still start or stop the server manually from the editor when this is on.\n",
    "kind": "boolean",
    "group": "launch",
    "section": "Starting",
    "order": 30,
    "defaultValue": true,
    "changeClass": "hot",
    "restartRequired": false
  },
  {
    "key": "launch.extraArgs",
    "title": "Extra command-line options",
    "description": "Additional options passed to cbserver beyond the settings in this panel.",
    "tooltip": "Only if documentation asks for a flag not available as a setting here.",
    "detailed": "## Extra command-line options\n\n**When to leave empty (default):**  \nAll options you need are configured through this settings panel.\n\n**When to add entries:**  \n- Official documentation names a cbserver flag that has no matching setting here  \n- Your administrator instructed you to pass specific extra options  \n\nExample: checking the server version once with `-version` (then remove it again).\n",
    "kind": "string[]",
    "group": "launch",
    "section": "Advanced",
    "order": 40,
    "defaultValue": [],
    "changeClass": "warm",
    "mapsToCli": "trailing argv",
    "restartRequired": true,
    "docRef": "docs/CONFIGURATION.md#mmkitserverextraargs"
  },
  {
    "key": "network.port",
    "title": "TCP port",
    "description": "Port number clients use to connect to your server (2000–65535).",
    "tooltip": "Default 4001 — standard for ConceptBase.cc. Change if that port is busy.",
    "detailed": "## TCP port\n\n**When to use 4001 (default):**  \n- First-time setup  \n- CBShell and examples use `localhost:4001`  \n- No other program on your machine uses this port  \n\n**When to choose another port:**  \n- Port 4001 is already taken (another cbserver, another application)  \n- Your IT policy assigns a specific port  \n- You run several ConceptBase instances on one machine (each needs its own port)  \n\nIf you change the port, **update your clients** to connect to the same number.\n",
    "kind": "number",
    "group": "network",
    "section": "Connection",
    "order": 10,
    "defaultValue": 4001,
    "changeClass": "warm",
    "mapsToEnv": "CB_PORTNR",
    "mapsToCli": "-p",
    "min": 2000,
    "max": 65535,
    "step": 1,
    "restartRequired": true,
    "docRef": "components/doc/user-manual/chapters/CBserver.typ#sec:cbsparams"
  },
  {
    "key": "paths.dataDir",
    "title": "Data folder",
    "description": "Main folder for your ConceptBase data (database, temporary files).",
    "tooltip": "Default is a hidden folder in your home directory (~/.mmkit).",
    "detailed": "## Data folder\n\n**When to use the default (`~/.mmkit`):**  \nPersonal use on your own computer — all project data stays in one place under\nyour home directory.\n\n**When to choose another folder:**  \n- You want data on a larger disk (external drive, network share you trust)  \n- Company policy requires a specific data location  \n- You maintain separate data roots for different environments  \n\nTypical layout created automatically:\n\n```\n~/.mmkit/\n  workspace/   your knowledge base and modules\n  tmp/         temporary copies for non-persistent sessions\n```\n",
    "kind": "string",
    "group": "paths",
    "section": "Main location",
    "order": 10,
    "defaultValue": "~/.mmkit",
    "changeClass": "warm",
    "scope": "application",
    "restartRequired": true,
    "placeholder": "~/.mmkit",
    "docRef": "docs/CONFIGURATION.md#mmkitserverdatadir"
  },
  {
    "key": "paths.updateMode",
    "title": "Keep changes after restart",
    "description": "Whether tells and untells are saved permanently or only for this session.",
    "tooltip": "Persistent = your work is kept; non-persistent = discarded when the server stops.",
    "detailed": "## Keep changes after restart\n\n**When to choose Persistent (default for projects):**  \n- You are building a knowledge base over days or weeks  \n- You need your tells, rules, and data after closing the editor  \n- Normal production or development work  \n\n**When to choose Non-persistent:**  \n- Quick try-out of ideas you do not want to keep  \n- Demonstrations where each session should start clean  \n- Temporary sandbox without polluting your real workspace  \n\nNon-persistent sessions may use a copy under the temporary folder; that copy\nis removed when the server stops.\n",
    "kind": "enum",
    "group": "paths",
    "section": "Persistency",
    "order": 20,
    "defaultValue": "persistent",
    "changeClass": "warm",
    "mapsToEnv": "CB_UPDATE_MODE",
    "mapsToCli": "-u",
    "restartRequired": true,
    "enumOptions": [
      {
        "value": "persistent",
        "label": "Persistent",
        "description": "Save changes to disk — use for real work you want to keep."
      },
      {
        "value": "nonpersistent",
        "label": "Non-persistent",
        "description": "Discard changes when the server stops — use for throwaway sessions."
      }
    ],
    "docRef": "components/doc/user-manual/chapters/CBserver.typ#sec:cbsparams"
  },
  {
    "key": "paths.databasePath",
    "title": "Database folder only",
    "description": "Folder that holds only the knowledge-base files (advanced layout).",
    "tooltip": "Leave empty to use the combined workspace folder — recommended for most users.",
    "detailed": "## Database folder only\n\n**When to leave empty (recommended):**  \nUse the combined workspace under your data folder — simpler and matches most guides.\n\n**When to set a specific folder:**  \n- You already have a database directory from an older setup  \n- You intentionally separate the database from module save/load paths  \n- Documentation for your deployment specifies a dedicated `-d` path  \n\n**Never** run two servers on the same folder. If the server crashed, you may need\nto remove a lock file (`OB.lock`) in that folder before restarting.\n",
    "kind": "string",
    "group": "paths",
    "section": "Database layout",
    "order": 30,
    "defaultValue": "",
    "changeClass": "warm",
    "mapsToEnv": "CB_DATABASE",
    "mapsToCli": "-d",
    "optional": true,
    "restartRequired": true,
    "related": [
      "paths.databaseAllPath",
      "paths.newDatabasePath",
      "paths.resetOnStart"
    ],
    "docRef": "components/man/man1/cbserver.1"
  },
  {
    "key": "paths.databaseAllPath",
    "title": "Workspace folder",
    "description": "One folder for database, saved modules, and views together.",
    "tooltip": "Empty uses data folder/workspace — the usual setup.",
    "detailed": "## Workspace folder\n\n**When to leave empty (default):**  \nYour workspace is `workspace` inside your data folder (e.g. `~/.mmkit/workspace`).\nThis is the right choice for most users.\n\n**When to set a custom path:**  \n- You keep project files in a specific directory (e.g. under version control)  \n- You share one workspace path across tools  \n- You use Docker or a scripted install with a fixed mount point  \n\nThis folder holds your database **and** is used for saving/loading modules and\nviews when those paths are not set separately.\n",
    "kind": "string",
    "group": "paths",
    "section": "Database layout",
    "order": 40,
    "defaultValue": "",
    "changeClass": "warm",
    "mapsToEnv": "CB_DB_ALL",
    "mapsToCli": "-db",
    "optional": true,
    "restartRequired": true,
    "related": [
      "paths.dataDir",
      "paths.databasePath"
    ],
    "docRef": "components/doc/user-manual/chapters/CBserver.typ#sec:cbsparams"
  },
  {
    "key": "paths.newDatabasePath",
    "title": "Create fresh database at path",
    "description": "Delete any existing database at this location and create a new empty one.",
    "tooltip": "Destructive — only when you intentionally want to wipe that location once.",
    "detailed": "## Create fresh database at path\n\n**When to leave empty (almost always):**  \nYou want to keep existing data or use the normal workspace.\n\n**When to set a path:**  \n- You are deliberately starting from scratch at a known location  \n- You are following a recovery procedure that says to use `-new`  \n\n**Warning:** All existing data at that path is **permanently removed**.  \nPrefer **Reset database on start** if you need a clean slate on every launch\nat the same path.\n",
    "kind": "string",
    "group": "paths",
    "section": "Database layout",
    "order": 50,
    "defaultValue": "",
    "changeClass": "warm",
    "mapsToEnv": "CB_NEW_DATABASE",
    "mapsToCli": "-new",
    "optional": true,
    "restartRequired": true,
    "docRef": "components/doc/user-manual/chapters/CBserver.typ#sec:cbsparams"
  },
  {
    "key": "paths.resetOnStart",
    "title": "Empty database every time server starts",
    "description": "Wipe and recreate the database at the database folder on each start.",
    "tooltip": "Use for repeatable clean sessions — all previous tells in that DB are lost each start.",
    "detailed": "## Empty database every time server starts\n\n**When to leave off (default):**  \nYou want your knowledge base to accumulate changes over time.\n\n**When to turn on:**  \n- Each work session must begin with an empty database at a fixed path  \n- Automated demos or training that always start from zero  \n- You are developing against a seed path and need a fresh copy every run  \n\nRequires a database folder to be configured. Does not apply if you use\n\"Create fresh database at path\" instead.\n",
    "kind": "boolean",
    "group": "paths",
    "section": "Database layout",
    "order": 60,
    "defaultValue": false,
    "changeClass": "warm",
    "mapsToEnv": "CB_RESET_ON_START",
    "restartRequired": true,
    "related": [
      "paths.databasePath",
      "paths.newDatabasePath"
    ]
  },
  {
    "key": "paths.tmpDir",
    "title": "Temporary files folder",
    "description": "Where short-lived database copies are stored for non-persistent sessions.",
    "tooltip": "Leave empty to use data folder/tmp. Only relevant with non-persistent mode.",
    "detailed": "## Temporary files folder\n\n**When to leave empty (default):**  \nTemporary files go under `tmp` in your data folder.\n\n**When to set a custom folder:**  \n- Non-persistent mode and your disk is tight on the default volume  \n- Policy requires temp data on a specific drive  \n\nOnly matters when **Keep changes after restart** is **Non-persistent**.  \nContents are removed when the server exits.\n",
    "kind": "string",
    "group": "paths",
    "section": "Extra folders",
    "order": 70,
    "defaultValue": "",
    "changeClass": "warm",
    "mapsToEnv": "TMPDIR",
    "optional": true,
    "restartRequired": true,
    "related": [
      "paths.updateMode",
      "paths.dataDir"
    ]
  },
  {
    "key": "paths.loadDir",
    "title": "Load modules from folder at startup",
    "description": "Folder of module source files (*.sml) to load when the server starts.",
    "tooltip": "Leave empty if you do not load modules from disk at startup.",
    "detailed": "## Load modules at startup\n\n**When to leave empty (default):**  \nYou work entirely inside the database, or modules are already in the workspace.\n\n**When to set a folder:**  \n- You export module listings (.sml files) and want them re-imported each start  \n- You maintain module sources in a separate directory (e.g. from version control)  \n\nFiles are read-only at startup; the folder is not modified by the server.\n",
    "kind": "string",
    "group": "paths",
    "section": "Extra folders",
    "order": 80,
    "defaultValue": "",
    "changeClass": "warm",
    "mapsToEnv": "CB_LOAD_DIR",
    "mapsToCli": "-load",
    "optional": true,
    "restartRequired": true,
    "docRef": "components/doc/user-manual/chapters/CBserver.typ#sec:cbsparams"
  },
  {
    "key": "paths.saveDir",
    "title": "Save modules to folder",
    "description": "Folder where module listings are written when you shut down or disconnect.",
    "tooltip": "Folder must exist. Leave empty to disable saving module files to disk.",
    "detailed": "## Save modules to folder\n\n**When to leave empty (default):**  \nYou do not need `.sml` module exports on disk, or you use the combined workspace\nwhich handles saving automatically.\n\n**When to set a folder:**  \n- You want backup-style module listings on shutdown  \n- You feed saved modules into **Load modules from folder** on the next run  \n- You archive module trees for documentation or version control  \n\nThe directory must **already exist** before the server can write to it.\n",
    "kind": "string",
    "group": "paths",
    "section": "Extra folders",
    "order": 90,
    "defaultValue": "",
    "changeClass": "warm",
    "mapsToEnv": "CB_SAVE_DIR",
    "mapsToCli": "-save",
    "optional": true,
    "restartRequired": true
  },
  {
    "key": "paths.viewsDir",
    "title": "Materialized views folder",
    "description": "Folder where selected query results are stored as materialized views.",
    "tooltip": "Leave empty unless you use materialized views and know you need this feature.",
    "detailed": "## Materialized views folder\n\n**When to leave empty (default):**  \nYou do not use materialized views, or you are unsure what they are.\n\n**When to set a folder:**  \n- You use ConceptBase views and want query results written to disk for faster reload  \n- Your project documentation specifies a views directory  \n\nSee the ConceptBase user manual section on module views for details.\n",
    "kind": "string",
    "group": "paths",
    "section": "Extra folders",
    "order": 100,
    "defaultValue": "",
    "changeClass": "warm",
    "mapsToEnv": "CB_VIEWS_DIR",
    "mapsToCli": "-views",
    "optional": true,
    "restartRequired": true
  },
  {
    "key": "runtime.traceMode",
    "title": "Diagnostic messages",
    "description": "How much technical output the server prints while running.",
    "tooltip": "Does not change your data — only how chatty the server is in the log.",
    "detailed": "## Diagnostic messages\n\n**When to use No (default):**  \nNormal everyday use — standard interface messages only.\n\n**When to use Silent:**  \nYou want minimal console output (e.g. automated environment where a \"ready\"\nbanner is not needed).\n\n**When to use Low or Minimal:**  \nYou are troubleshooting connection or query issues and need more detail.\n\n**When to use High or Very high:**  \nOnly when ConceptBase support asks you to — captures deep diagnostics and\nmay pause on serious errors for interactive analysis.\n",
    "kind": "enum",
    "group": "runtime",
    "section": "Diagnostics",
    "order": 10,
    "defaultValue": "no",
    "changeClass": "hot",
    "mapsToEnv": "CB_TRACEMODE",
    "mapsToCli": "-t",
    "restartRequired": false,
    "enumOptions": [
      {
        "value": "silent",
        "label": "Silent",
        "description": "Almost no messages — for quiet or automated setups."
      },
      {
        "value": "no",
        "label": "No",
        "description": "Standard messages — recommended for normal use."
      },
      {
        "value": "minimal",
        "label": "Minimal",
        "description": "Slightly more detail when investigating issues."
      },
      {
        "value": "low",
        "label": "Low",
        "description": "Interface activity plus answers — helpful for support."
      },
      {
        "value": "high",
        "label": "High",
        "description": "Deep diagnostics — use when support requests it."
      },
      {
        "value": "veryhigh",
        "label": "Very high",
        "description": "Maximum detail — expert troubleshooting only."
      }
    ]
  },
  {
    "key": "runtime.untellMode",
    "title": "Untell behaviour",
    "description": "How removing objects (UNTELL) cleans up related system information.",
    "tooltip": "Cleanup is usually correct; verbatim only for special compatibility needs.",
    "detailed": "## Untell behaviour\n\n**When to use Cleanup (default):**  \nNormal editing — removing an object behaves like the opposite of telling it,\nincluding standard system links (Individual, Attribute, etc.).\n\n**When to use Verbatim:**  \nYou were explicitly told to match legacy behaviour, or you only want to remove\nthe exact facts in your frame without wider cleanup.\n\nIf unsure, keep **Cleanup**.\n",
    "kind": "enum",
    "group": "runtime",
    "section": "Diagnostics",
    "order": 20,
    "defaultValue": "cleanup",
    "changeClass": "warm",
    "mapsToEnv": "CB_UNTELL_MODE",
    "mapsToCli": "-U",
    "restartRequired": true,
    "enumOptions": [
      {
        "value": "cleanup",
        "label": "Cleanup",
        "description": "Standard behaviour — mirrors tell when you remove objects."
      },
      {
        "value": "verbatim",
        "label": "Verbatim",
        "description": "Remove only what you specify — advanced or legacy scenarios."
      }
    ]
  },
  {
    "key": "runtime.cacheMode",
    "title": "Query cache",
    "description": "Whether the server remembers intermediate query results to speed up work.",
    "tooltip": "Keep is recommended; turn off only if you suspect cache-related oddities.",
    "detailed": "## Query cache\n\n**When to use Keep (default):**  \nNormal use — faster recursive queries, cache cleared when data changes or\nwhen it grows too large.\n\n**When to use Transient:**  \nYou want caching within a transaction but a clean cache for each new transaction.\n\n**When to use Off:**  \nRare — diagnosing a problem that might involve stale cached results (with expert\nguidance).\n",
    "kind": "enum",
    "group": "runtime",
    "section": "Query performance",
    "order": 10,
    "defaultValue": "keep",
    "changeClass": "warm",
    "mapsToEnv": "CB_CACHE_MODE",
    "mapsToCli": "-c",
    "restartRequired": true,
    "related": [
      "runtime.cacheSize"
    ],
    "enumOptions": [
      {
        "value": "off",
        "label": "Off",
        "description": "No caching — slowest, simplest behaviour."
      },
      {
        "value": "transient",
        "label": "Transient",
        "description": "Cache cleared before each transaction."
      },
      {
        "value": "keep",
        "label": "Keep",
        "description": "Best performance for most workloads."
      }
    ]
  },
  {
    "key": "runtime.cacheSize",
    "title": "Query cache size",
    "description": "Maximum number of cached facts kept between transactions.",
    "tooltip": "Only adjust if you have very large queries and know you need more cache.",
    "detailed": "## Query cache size\n\n**When to use 60000 (default):**  \nTypical projects — sufficient for most recursive queries.\n\n**When to increase:**  \nVery large models and support or tuning guides suggest a larger cache.\n\n**When to decrease:**  \nMemory is limited on your machine and you are willing to trade speed for RAM.\n\nOnly applies when **Query cache** is set to **Keep**.\n",
    "kind": "number",
    "group": "runtime",
    "section": "Query performance",
    "order": 20,
    "defaultValue": 60000,
    "changeClass": "warm",
    "mapsToEnv": "CB_CACHE_SIZE",
    "mapsToCli": "-cs",
    "min": 0,
    "step": 1000,
    "restartRequired": true,
    "related": [
      "runtime.cacheMode"
    ]
  },
  {
    "key": "runtime.optimizerMode",
    "title": "Query optimizer",
    "description": "How aggressively the server optimises rules, constraints, and queries.",
    "tooltip": "Level 4 is recommended — only lower if advised for compatibility.",
    "detailed": "## Query optimizer\n\n**When to use 4 — Full (default):**  \nAll normal and production use — best performance and recommended by ConceptBase.\n\n**When to use a lower level:**  \n- Reproducing behaviour from an older server version  \n- Support asks you to isolate an optimisation-related issue  \n\nLevels 0–3 progressively disable structural optimisation, join ordering,\nand trigger pruning.\n",
    "kind": "enum",
    "group": "runtime",
    "section": "Query performance",
    "order": 30,
    "defaultValue": 4,
    "changeClass": "warm",
    "mapsToEnv": "CB_OPT_MODE",
    "mapsToCli": "-o",
    "restartRequired": true,
    "enumOptions": [
      {
        "value": 0,
        "label": "0 — None",
        "description": "No optimisation — slowest, for diagnosis only."
      },
      {
        "value": 1,
        "label": "1 — Structural",
        "description": "Basic structural optimisations only."
      },
      {
        "value": 2,
        "label": "2 — Join order",
        "description": "Join ordering without full structural package."
      },
      {
        "value": 3,
        "label": "3 — Structural + join",
        "description": "Combined partial optimisation."
      },
      {
        "value": 4,
        "label": "4 — Full (recommended)",
        "description": "Best performance — use unless you have a reason not to."
      }
    ]
  },
  {
    "key": "runtime.viewsMaintenance",
    "title": "Keep views up to date automatically",
    "description": "Update materialized views when the underlying data changes.",
    "tooltip": "Off unless you actively use materialized views that must stay current.",
    "detailed": "## Keep views up to date automatically\n\n**When to leave Off (default):**  \nYou do not use materialized views, or you refresh them manually.\n\n**When to turn On:**  \nYou rely on materialized views in daily work and need them to track tells and\nuntells automatically.\n\nRequires views to be configured (see views folder setting).\n",
    "kind": "enum",
    "group": "runtime",
    "section": "Query performance",
    "order": 40,
    "defaultValue": "off",
    "changeClass": "warm",
    "mapsToEnv": "CB_VIEWS_MAINT",
    "mapsToCli": "-v",
    "restartRequired": true,
    "enumOptions": [
      {
        "value": "off",
        "label": "Off",
        "description": "Default — no automatic view maintenance rules."
      },
      {
        "value": "on",
        "label": "On",
        "description": "Views stay synchronized when data changes."
      }
    ]
  },
  {
    "key": "runtime.stratificationMode",
    "title": "Stratification checks",
    "description": "Warn when rule evaluation might violate stratification rules.",
    "tooltip": "Leave on unless an expert confirms your rules are safe with checks off.",
    "detailed": "## Stratification checks\n\n**When to use On (default):**  \nNormal use — the server reports stratification problems as errors so you\nnotice incorrect rule setups early.\n\n**When to use Off:**  \nOnly when you fully understand your rule set and an expert has confirmed that\nreported violations can be ignored without harming results.\n",
    "kind": "enum",
    "group": "runtime",
    "section": "Query performance",
    "order": 50,
    "defaultValue": "on",
    "changeClass": "warm",
    "mapsToEnv": "CB_STRATIFICATION_MODE",
    "mapsToCli": "-st",
    "restartRequired": true,
    "enumOptions": [
      {
        "value": "on",
        "label": "On",
        "description": "Report stratification problems — recommended."
      },
      {
        "value": "off",
        "label": "Off",
        "description": "Suppress checks — expert use only."
      }
    ]
  },
  {
    "key": "runtime.securityLevel",
    "title": "Access control level",
    "description": "How strictly the server limits who can change or read what.",
    "tooltip": "Level 1 is fine for solo use; raise for shared or multi-user servers.",
    "detailed": "## Access control level\n\n**When to use 1 — Basic (default):**  \nSingle user or small trusted team — prevents accidental untells outside the\ncurrent module (protects system modules).\n\n**When to use 0 — None:**  \nCompletely open local sandbox — anyone connected can change anything.  \n**Not recommended** on shared networks.\n\n**When to use 2 — Full ACL:**  \nMulti-user deployment with permission rules defined in your model.\n\n**When to use 3 — Read-mostly:**  \nYou want to freeze a database so changes are heavily restricted — archival\nor published reference servers.\n",
    "kind": "enum",
    "group": "runtime",
    "section": "Security",
    "order": 10,
    "defaultValue": 1,
    "changeClass": "warm",
    "mapsToEnv": "CB_SECURITY_LEVEL",
    "mapsToCli": "-s",
    "restartRequired": true,
    "enumOptions": [
      {
        "value": 0,
        "label": "0 — None",
        "description": "No protection — local experiments only."
      },
      {
        "value": 1,
        "label": "1 — Basic",
        "description": "Sensible default for personal work."
      },
      {
        "value": 2,
        "label": "2 — Full ACL",
        "description": "Enforce module permission rules — shared servers."
      },
      {
        "value": 3,
        "label": "3 — Read-mostly",
        "description": "Heavily restrict changes — frozen or publish mode."
      }
    ]
  },
  {
    "key": "runtime.maxErrors",
    "title": "Error messages per transaction",
    "description": "Maximum number of errors shown for one tell/ask before the server stops listing more.",
    "tooltip": "Lower if huge error floods slow your client; -1 for no limit.",
    "detailed": "## Error messages per transaction\n\n**When to use 20 (default):**  \nNormal editing — enough errors to understand problems without flooding the client.\n\n**When to use -1 (unlimited):**  \nYou need every error line for a large validation or batch import.\n\n**When to use 0:**  \nSuppress error text entirely (rare, usually scripted scenarios).\n\n**When to use a small positive number (e.g. 5):**  \nVery large models where thousands of similar errors slow the UI.\n",
    "kind": "number",
    "group": "runtime",
    "section": "Security",
    "order": 20,
    "defaultValue": 20,
    "changeClass": "warm",
    "mapsToEnv": "CB_MAX_ERRORS",
    "mapsToCli": "-e",
    "min": -1,
    "step": 1,
    "restartRequired": true
  },
  {
    "key": "runtime.adminUser",
    "title": "Additional administrator",
    "description": "Another user name allowed to shut down the server.",
    "tooltip": "Optional. You can use user@hostname to restrict to one machine.",
    "detailed": "## Additional administrator\n\n**When to leave empty (default):**  \nOnly the person who started the server needs shutdown rights.\n\n**When to set a user name:**  \n- A colleague must be able to stop a shared server  \n- You designate a backup admin (`user` or `user@hostname`)  \n\nThe person who started the server can always shut it down as well.\n",
    "kind": "string",
    "group": "runtime",
    "section": "Security",
    "order": 30,
    "defaultValue": "",
    "changeClass": "warm",
    "mapsToEnv": "CB_ADMIN_USER",
    "mapsToCli": "-a",
    "optional": true,
    "restartRequired": true,
    "placeholder": ""
  },
  {
    "key": "runtime.multiUser",
    "title": "Allow several user names",
    "description": "Whether different client user names may connect at the same time.",
    "tooltip": "Disable only to limit connections to your user name — not a strong security lock.",
    "detailed": "## Allow several user names\n\n**When to use Enabled (default):**  \nMultiple people (or tools) connect with different ConceptBase user names —\nnormal collaborative or multi-tool setup.\n\n**When to use Disabled:**  \nYou want only clients that present **your** user name to connect — light\nrestriction on a single machine, not a substitute for network security.\n\nFor real protection on a network, use firewalls and access control level 2+.\n",
    "kind": "enum",
    "group": "runtime",
    "section": "Security",
    "order": 40,
    "defaultValue": "enabled",
    "changeClass": "warm",
    "mapsToEnv": "CB_MULTI_USER",
    "mapsToCli": "-mu",
    "restartRequired": true,
    "enumOptions": [
      {
        "value": "enabled",
        "label": "Enabled",
        "description": "Several user names can connect — normal shared use."
      },
      {
        "value": "disabled",
        "label": "Disabled",
        "description": "Only matching user name — personal machine preference."
      }
    ]
  },
  {
    "key": "runtime.moduleSeparator",
    "title": "Module file layout",
    "description": "How saved module files are arranged on disk — flat or in subfolders.",
    "tooltip": "Hyphen = all files in one folder; slash = folders mirror module hierarchy.",
    "detailed": "## Module file layout\n\n**When to use Hyphen — flat (default):**  \nSimple projects — all `.sml` files in one directory.\n\n**When to use Slash — nested:**  \nLarge module trees where you want folder structure on disk to mirror modules\n(easier to browse in the file manager).\n",
    "kind": "enum",
    "group": "runtime",
    "section": "Modules",
    "order": 10,
    "defaultValue": "-",
    "changeClass": "warm",
    "mapsToEnv": "CB_MODULE_SEPARATOR",
    "mapsToCli": "-ms",
    "restartRequired": true,
    "enumOptions": [
      {
        "value": "-",
        "label": "Hyphen (flat)",
        "description": "All module files in one folder — simplest layout."
      },
      {
        "value": "/",
        "label": "Slash (nested)",
        "description": "Subfolders match module structure — large projects."
      }
    ]
  },
  {
    "key": "runtime.moduleGeneration",
    "title": "Module export style",
    "description": "How transaction boundaries appear inside exported module (.sml) files.",
    "tooltip": "Split is default; minsplit if reload speed matters with large exports.",
    "detailed": "## Module export style\n\n**When to use Split (default):**  \nNormal saves — clear separators between transactions in each module file.\n\n**When to use Whole:**  \nYou prefer one continuous file without transaction markers.\n\n**When to use Minimal split:**  \nLarge modules where reload is slow and you want fewer separators while still\nsupporting meta-formulas in the same module.\n",
    "kind": "enum",
    "group": "runtime",
    "section": "Modules",
    "order": 20,
    "defaultValue": "split",
    "changeClass": "warm",
    "mapsToEnv": "CB_MODULE_GENERATION",
    "mapsToCli": "-mg",
    "restartRequired": true,
    "enumOptions": [
      {
        "value": "split",
        "label": "Split",
        "description": "Default — separators per transaction."
      },
      {
        "value": "whole",
        "label": "Whole",
        "description": "Single block without separators."
      },
      {
        "value": "minsplit",
        "label": "Minimal split",
        "description": "Fewer separators — faster reload of big modules."
      }
    ]
  },
  {
    "key": "runtime.ruleLabels",
    "title": "Readable names for generated rules",
    "description": "Whether auto-generated formulas get human-readable labels.",
    "tooltip": "Off avoids rare duplicate-label issues; on is easier to read in the UI.",
    "detailed": "## Readable names for generated rules\n\n**When to use On (default):**  \nYou inspect generated formulas in the UI and want names built from attribute labels.\n\n**When to use Off:**  \nYou hit duplicate-label problems or prefer stable system-generated identifiers.\n",
    "kind": "enum",
    "group": "runtime",
    "section": "Modules",
    "order": 30,
    "defaultValue": "on",
    "changeClass": "warm",
    "mapsToEnv": "CB_RULE_LABELS",
    "mapsToCli": "-rl",
    "restartRequired": true,
    "enumOptions": [
      {
        "value": "on",
        "label": "On",
        "description": "Human-readable labels — easier to understand."
      },
      {
        "value": "off",
        "label": "Off",
        "description": "Unique system ids — avoids label clashes."
      }
    ]
  },
  {
    "key": "runtime.ccMode",
    "title": "Query type checking",
    "description": "How strictly the server checks predicate types in queries.",
    "tooltip": "Strict catches mistakes early; relaxed modes only if you know you need them.",
    "detailed": "## Query type checking\n\n**When to use Strict (default):**  \nNormal modelling — catches ambiguous predicates before they cause subtle errors.\n\n**When to use Extended:**  \nYou need subclass search for concerned classes in advanced queries.\n\n**When to use Off:**  \nLegacy models or expert scenarios — rules and constraints are still enforced.\n",
    "kind": "enum",
    "group": "runtime",
    "section": "Advanced queries",
    "order": 10,
    "defaultValue": "strict",
    "changeClass": "warm",
    "mapsToEnv": "CB_CC_MODE",
    "mapsToCli": "-cc",
    "restartRequired": true,
    "enumOptions": [
      {
        "value": "strict",
        "label": "Strict",
        "description": "Recommended — strict predicate typing in queries."
      },
      {
        "value": "extended",
        "label": "Extended",
        "description": "Allow subclass-based typing search."
      },
      {
        "value": "off",
        "label": "Off",
        "description": "Permissive queries — use with care."
      }
    ]
  },
  {
    "key": "runtime.maxCost",
    "title": "Meta-formula search effort",
    "description": "How hard the server searches when compiling meta-formulas.",
    "tooltip": "Raise if meta-formulas fail to compile; lower if compilation is too slow.",
    "detailed": "## Meta-formula search effort\n\n**When to use 100 (default):**  \nTypical meta-formulas with up to about two free variables in paths.\n\n**When to use ~10:**  \nSimple meta-formulas with at most one free variable — faster compilation.\n\n**When to raise above 100:**  \nComplex meta-formulas fail to compile and an expert suggests more search breadth\n(accept slower compile times).\n",
    "kind": "number",
    "group": "runtime",
    "section": "Advanced queries",
    "order": 20,
    "defaultValue": 100,
    "changeClass": "warm",
    "mapsToEnv": "CB_MAX_COST",
    "mapsToCli": "-mc",
    "min": 1,
    "step": 10,
    "restartRequired": true
  },
  {
    "key": "runtime.pathLength",
    "title": "Meta-formula path depth",
    "description": "Maximum length of binding paths considered for meta-formulas.",
    "tooltip": "Set 0 only to disable meta-formulas entirely.",
    "detailed": "## Meta-formula path depth\n\n**When to use 5 (default):**  \nNormal meta-formula use.\n\n**When to lower:**  \nCompilation is too slow and you accept fewer candidate paths.\n\n**When to set 0:**  \nYou must disable meta-formula compilation entirely (specialised setups only).\n",
    "kind": "number",
    "group": "runtime",
    "section": "Advanced queries",
    "order": 30,
    "defaultValue": 5,
    "changeClass": "warm",
    "mapsToEnv": "CB_PATH_LENGTH",
    "mapsToCli": "-pl",
    "min": 0,
    "step": 1,
    "restartRequired": true
  },
  {
    "key": "runtime.iterMax",
    "title": "Query reordering effort",
    "description": "How many passes the server uses to reorder predicates for faster queries.",
    "tooltip": "Increase slightly if experts tune performance; default suits most users.",
    "detailed": "## Query reordering effort\n\n**When to use 3 (default):**  \nBalanced performance for typical models.\n\n**When to increase:**  \nLarge models with slow queries and tuning guidance recommends more iterations.\n\n**When to lower:**  \nRare — reducing work per query at the cost of speed.\n",
    "kind": "number",
    "group": "runtime",
    "section": "Advanced queries",
    "order": 40,
    "defaultValue": 3,
    "changeClass": "warm",
    "mapsToEnv": "CB_ITER_MAX",
    "mapsToCli": "-im",
    "min": 0,
    "step": 1,
    "restartRequired": true
  },
  {
    "key": "runtime.ecaMode",
    "title": "Event-action rules (ECA)",
    "description": "How event-condition-action rules run when data changes.",
    "tooltip": "Safe is default; unsafe only if your rules never need extra safeguards.",
    "detailed": "## Event-action rules (ECA)\n\n**When to use Safe (default):**  \nYou use ECA rules and want protection against problematic interaction with\nrecursive rules.\n\n**When to use Unsafe:**  \nPerformance tuning only — you are sure no ECA rule calls recursive predicates\non the latest database state (expert judgement).\n\n**When to use Off:**  \nYou do not use ECA at all, or need to disable rule evaluation temporarily.\n",
    "kind": "enum",
    "group": "runtime",
    "section": "Rules and events",
    "order": 10,
    "defaultValue": "safe",
    "changeClass": "warm",
    "mapsToEnv": "CB_ECA_MODE",
    "mapsToCli": "-eca",
    "restartRequired": true,
    "enumOptions": [
      {
        "value": "safe",
        "label": "Safe",
        "description": "Protected evaluation — recommended."
      },
      {
        "value": "unsafe",
        "label": "Unsafe",
        "description": "Faster — only if you understand the risks."
      },
      {
        "value": "off",
        "label": "Off",
        "description": "ECA rules not evaluated."
      }
    ]
  },
  {
    "key": "runtime.ecaOptimizer",
    "title": "ECA condition ordering",
    "description": "Whether the server reorders conditions inside ECA rules for speed.",
    "tooltip": "Turn off only if rule order must be exactly as you wrote it.",
    "detailed": "## ECA condition ordering\n\n**When to use On (default):**  \nLet the server reorder predicates in ECA conditions for better performance.\n\n**When to use Off:**  \nYou depend on a specific evaluation order you coded manually (advanced).\n",
    "kind": "enum",
    "group": "runtime",
    "section": "Rules and events",
    "order": 20,
    "defaultValue": "on",
    "changeClass": "warm",
    "mapsToEnv": "CB_ECA_OPTIMIZER",
    "mapsToCli": "-eo",
    "restartRequired": true,
    "enumOptions": [
      {
        "value": "on",
        "label": "On",
        "description": "Automatic reordering — recommended."
      },
      {
        "value": "off",
        "label": "Off",
        "description": "Preserve your written order exactly."
      }
    ]
  },
  {
    "key": "runtime.restartDelaySeconds",
    "title": "Restart after crash",
    "description": "Seconds to wait before automatically restarting the server after a failure.",
    "tooltip": "Leave unset (disabled) on your PC — mainly for unattended shared servers.",
    "detailed": "## Restart after crash\n\n**When to leave unset / disabled (default for personal use):**  \nYou start the server yourself and want to see errors instead of silent restarts.\n\n**When to set a delay (e.g. 30 seconds):**  \nUnattended server on another machine that should come back after crashes.\n\n**Caution:** If the database is corrupted, automatic restart can loop forever.\nFix the underlying problem before enabling this on important data.\n",
    "kind": "number",
    "group": "runtime",
    "section": "When the server stops",
    "order": 10,
    "defaultValue": null,
    "changeClass": "warm",
    "mapsToEnv": "CB_RESTART_SECS",
    "mapsToCli": "-r",
    "optional": true,
    "min": 0,
    "step": 1,
    "restartRequired": true,
    "related": [
      "runtime.serverMode"
    ]
  },
  {
    "key": "runtime.inactivityHours",
    "title": "Active client timeout (hours)",
    "description": "How long a client must stay active before being treated as idle.",
    "tooltip": "Only relevant with slave mode, auto-restart, or public server setups.",
    "detailed": "## Active client timeout\n\n**When to use 2 (default):**  \nStandard behaviour when using slave or public server options.\n\n**When to use a negative value:**  \nTreat clients as never timing out for inactivity (expert / special deployments).\n\n**When to change for normal desktop use:**  \nUsually unnecessary — only adjust if documentation for your deployment says so.\n",
    "kind": "number",
    "group": "runtime",
    "section": "When the server stops",
    "order": 20,
    "defaultValue": 2,
    "changeClass": "warm",
    "mapsToEnv": "CB_INACTIVITY_HOURS",
    "mapsToCli": "-ia",
    "step": 0.5,
    "restartRequired": true
  },
  {
    "key": "runtime.serverMode",
    "title": "Stop when last client disconnects",
    "description": "Whether the server keeps running after everyone disconnects.",
    "tooltip": "Master = stays running; Slave = may stop when the last client leaves.",
    "detailed": "## Stop when last client disconnects\n\n**When to use Master (default in the editor):**  \nThe server stays up until you explicitly stop it — best when you reconnect often\nor use multiple tools against one server.\n\n**When to use Slave:**  \nThe server should shut down when the last client disconnects (same OS user) —\ncompanion mode for a single application session, or saving resources on a laptop.\n\nBare `cbserver` without options defaults to slave; the editor defaults to master\nfor convenience.\n",
    "kind": "enum",
    "group": "runtime",
    "section": "When the server stops",
    "order": 30,
    "defaultValue": "master",
    "changeClass": "warm",
    "mapsToEnv": "CB_SERVER_MODE",
    "mapsToCli": "-sm",
    "restartRequired": true,
    "enumOptions": [
      {
        "value": "master",
        "label": "Master",
        "description": "Server runs until you stop it — usual for development."
      },
      {
        "value": "slave",
        "label": "Slave",
        "description": "Server may exit when the last client disconnects."
      }
    ]
  },
  {
    "key": "runtime.devCommand",
    "title": "Special startup mode",
    "description": "One-shot behaviours at startup (ignore plugins, public server, exit after setup).",
    "tooltip": "Leave unset unless documentation describes nolpi, public, or exit.",
    "detailed": "## Special startup mode\n\n**When to leave unset (default):**  \nNormal server that stays running for clients.\n\n**When to choose No LPI:**  \nPlug-in files (.lpi) cause problems and you must ignore them.\n\n**When to choose Public server:**  \nYou are configuring a publicly accessible server per ConceptBase documentation.\n\n**When to choose Exit after tasks:**  \nOne-shot job — e.g. materialize views or export data at startup, then quit.\nOften used with workspace and views folders set for batch export.\n\nNot the same as **Custom start command** under Starting the server.\n",
    "kind": "enum",
    "group": "runtime",
    "section": "When the server stops",
    "order": 40,
    "defaultValue": null,
    "changeClass": "warm",
    "mapsToEnv": "CB_DEV_CMD",
    "mapsToCli": "-g",
    "optional": true,
    "restartRequired": true,
    "enumOptions": [
      {
        "value": "nolpi",
        "label": "No LPI",
        "description": "Ignore plug-in files at startup."
      },
      {
        "value": "public",
        "label": "Public server",
        "description": "Configure as a public ConceptBase server."
      },
      {
        "value": "exit",
        "label": "Exit after tasks",
        "description": "Run startup tasks then shut down — batch export scenarios."
      }
    ]
  },
  {
    "key": "mmkit.killGraceMs",
    "title": "Shutdown wait time (milliseconds)",
    "description": "How long the editor waits for a clean server stop before forcing exit.",
    "tooltip": "Increase if the server often needs more time to save on shutdown.",
    "detailed": "## Shutdown wait time\n\n**When to use 5000 ms (default):**  \nNormal shutdown — five seconds is enough for the server to exit cleanly.\n\n**When to increase:**  \nLarge databases where shutdown saves many modules and often times out.\n\n**When to decrease:**  \nYou prefer a quicker force-stop on slow machines (risk of incomplete save if\nsave-on-shutdown is enabled).\n",
    "kind": "number",
    "group": "mmkit",
    "section": "Shutdown",
    "order": 10,
    "defaultValue": 5000,
    "changeClass": "warm",
    "min": 0,
    "step": 100,
    "restartRequired": false,
    "examples": [
      "5000",
      "10000"
    ]
  },
  {
    "key": "mmkit.clientToolName",
    "title": "Editor tool name",
    "description": "Name the editor reports to the server when connecting.",
    "tooltip": "Change only if the server expects a specific tool name for your site.",
    "detailed": "## Editor tool name\n\n**When to use mmkit-server (default):**  \nStandard mmkit / editor connection.\n\n**When to change:**  \nYour server's access rules or logging expect a different tool identifier\n(organisation-specific setup).\n",
    "kind": "string",
    "group": "mmkit",
    "section": "Your identity on the server",
    "order": 20,
    "defaultValue": "mmkit-server",
    "changeClass": "warm",
    "restartRequired": true,
    "placeholder": "mmkit-server"
  },
  {
    "key": "mmkit.clientUserName",
    "title": "Your user name on the server",
    "description": "User name the editor presents when connecting to ConceptBase.",
    "tooltip": "Should match how you identify yourself in multi-user or ACL setups.",
    "detailed": "## Your user name on the server\n\n**When to use mmkit (default):**  \nPersonal local work with default security.\n\n**When to set your own name:**  \n- Multi-user server with access control — must match your ConceptBase user  \n- Several people share one machine but use distinct names on the server  \n- Logging and auditing should show your real username  \n\nThis is the **ConceptBase user name**, not necessarily your Windows or Linux login.\n",
    "kind": "string",
    "group": "mmkit",
    "section": "Your identity on the server",
    "order": 30,
    "defaultValue": "mmkit",
    "changeClass": "warm",
    "restartRequired": true,
    "placeholder": "mmkit"
  }
] as const;
