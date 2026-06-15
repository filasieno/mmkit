# MmkitServerActor — event storming map

**Actor:** `MmkitServerActor` (`mmkit-server-actor.hsm.ts`)  
**Supervisor:** `ServerSupervisor` (LSP `mmkit/server/*` → posts events below)

## States

| State | Phase (`MmkitServerPhase`) |
| ----- | -------------------------- |
| `Idle` | `idle` |
| `Starting` | `starting` |
| `Installing*` substates | `installing` |
| `Running` | `running` |
| `Stopping` | `stopping` |
| `ShuttingDown` | terminal shutdown |

## External events (user / LSP / shutdown)

| Event | Source | From state | To / effect |
| ----- | ------ | ---------- | ----------- |
| `userStart(snapshot, generation)` | `mmkit/server/start` | `Idle` | `Starting` |
| `userStart` (invalid snapshot) | start handler | any | stay, emit fault notification |
| `userStop` | `mmkit/server/stop` | `Running`, install* | `Stopping` |
| `snapshotUpdated` | `mmkit/config/update` | any | update ctx only |
| `shutdownRequested` | process SIGTERM | any active | `Stopping` → `ShuttingDown` |
| `traceLevelChanged` | supervisor | any | no-op (hook) |

## Install pipeline (internal)

| Event | Trigger | Next state |
| ----- | ------- | ---------- |
| `beginInstallPipeline` | `Starting.onEntry` | `InstallingPrepare` |
| `installPrepare` | `InstallingPrepare.onEntry` | dirs created → `InstallingMaterializeAssets` |
| `installMaterializeAssets` | onEntry | copy workspace + **cbserver binary** → `InstallingEnsureDockerImage` |
| `installEnsureDockerImage` | onEntry | docker pull **or** skip (executable) → `InstallingLaunchContainer` |
| `installLaunchContainer` | onEntry | `docker.run` / `process.spawn` → `InstallingAwaitPort` |
| `installAwaitPort` | onEntry | probe loop → `portReady` or `installFailed` |
| `portReady` | probe success | `Running` |
| `installFailed(error)` | any install step | emit fault → `installFailureTeardown` |
| `installFailureTeardown` | after failure | tear down → `Idle` |
| `beginStop` | `Stopping.onEntry` | async tearDown → `Idle` or `ShuttingDown` |

## Runtime events

| Event | Source | Effect |
| ----- | ------ | ------ |
| `processExited(code)` | `process.onExit` | `Running`/`Installing*` → `Idle` + fault notification |
| `fastStartThresholdElapsed` | timer (`FAST_START_THRESHOLD_MS`) | show install progress UI |

## Port actuators (test fault injection)

Each port method can inject `throw` or `return-error`:

- `fs.ensureDir`, `fs.exists`
- `assets.isInstallationComplete`, `assets.materialize`
- `docker.imageExists`, `docker.pullImage`, `docker.run`, `docker.stop`
- `process.spawn`, `process.kill`
- `network.probe`

Expected outcomes: `installFailed` → `Idle` (never stuck in `Installing*`).

## Notifications emitted

`mmkit/server/state` via `ServerNotifier.emitState` on every meaningful transition.
