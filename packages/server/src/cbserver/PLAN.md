# CBServer + CBConnection Refactor Plan

## 1. Goal

Split responsibilities clearly:

- `CBServerActor` owns only **process lifecycle + observability + connection creation**.
- `CBConnectionActor` owns **command transport/session protocol + request queueing + reply parsing**.

This removes command logic (`tell`/`ask`/...) from server lifecycle states and gives a dedicated connection abstraction we can test independently.

## 2. Problem Statement

Current design couples:

- process start/stop/restart logic
- reader/writer subactors
- command queue and reply handling

in one actor hierarchy, which makes behavior hard to reason about and evolve.

Additionally, current evidence shows real `cbserver` is documented and validated for **TCP mode**.

Therefore, this plan standardizes on TCP only.

## 3. Scope

In scope:

- new `CBConnectionActor` + `CBConnection` interface
- reduce `CBServerActor` to lifecycle + create/track connections
- TCP-only connection protocol and ports
- full protocol/state/invariant definitions
- test architecture split by responsibility

Out of scope (for first implementation):

- changing cbserver native/prolog internals
- adding undocumented transport/protocol assumptions without proof
- parallel command execution within one connection

## 4. Architecture

### 4.1 High-level components

- `CBServerActor` (supervisor)
  - spawn/monitor/stop `cbserver`
  - expose server status
  - read process `stdout` and `stderr` line-by-line
  - expose process IO subscription for `stdout`/`stderr` lines
  - create `CBConnectionActor` instances
- `CBConnectionActor` (session)
  - owns one TCP session to server
  - serial command queue
  - request/response correlation
  - reply parsing to `IpcAnswer`
- transport mechanism is internal to `CBConnectionActor` and not part of the public plan surface

### 4.2 Ownership model

- Server actor never parses command replies.
- Connection actor never spawns/kills server process.
- Server may host multiple connections.
- Each connection guarantees strict in-order command processing.
- Server can create connection actors only; connection shutdown is owned by each `CBConnection`.

## 5. Transport Decision

TCP is the only supported transport because it is documented in manual/manpage and passes smoke tests.

No stdio command transport is implemented in this plan.

## 6. API / Protocol Spec

## 6.1 New public interface: `CBConnection`

```ts
type CBReject = ihsm.RejectCallback;
type CBResolve<T> = ihsm.ResolveCallback<T>;

type CBFrames = string;
type CBQuery = string;
type CBLpiCall = string;
type CBStatement = string;
type CBModulePath = string;
type CBClassName = string;
type CBModuleName = string;
type CBObjectName = string;
type CBFilePath = string;

type CBQueryFormat = string; // e.g. "ASK", "OBJNAMES"
type CBAnswerRep = string;   // e.g. "default"
type CBRollbackTime = string; // e.g. "Now"
type CBProcessStream = "stdout" | "stderr";

type IpcCompletion = "ok" | "error" | "not_handled" | "notification" | "timeout" | "broken";

interface CBIpcAnswer {
  ok: boolean;
  completion: IpcCompletion;
  result?: string;
  term: string;
}

type StatusListener = (stateName: string) => void;
type ProcessIoListener = (stream: CBProcessStream, line: string) => void;

export interface ICBConnection {
  getConnectionId(resolve: CBResolve<string>, reject: CBReject): Promise<void>;
  close(): void;

  tell(resolve: CBResolve<CBIpcAnswer>, reject: CBReject, frames: CBFrames): Promise<void>;
  untell(resolve: CBResolve<CBIpcAnswer>, reject: CBReject, frames: CBFrames): Promise<void>;
  retell(resolve: CBResolve<CBIpcAnswer>, reject: CBReject, untellFrames: CBFrames, tellFrames: CBFrames): Promise<void>;
  tellModel(resolve: CBResolve<CBIpcAnswer>, reject: CBReject, ...files: CBFilePath[]): Promise<void>;
  ask(
    resolve: CBResolve<CBIpcAnswer>,
    reject: CBReject,
    query: CBQuery,
    queryFormat?: CBQueryFormat,
    answerRep?: CBAnswerRep,
    rollbackTime?: CBRollbackTime,
  ): Promise<void>;
  hypoAsk(
    resolve: CBResolve<CBIpcAnswer>,
    reject: CBReject,
    frames: CBFrames,
    query: CBQuery,
    queryFormat?: CBQueryFormat,
    answerRep?: CBAnswerRep,
    rollbackTime?: CBRollbackTime,
  ): Promise<void>;
  lpicall(resolve: CBResolve<CBIpcAnswer>, reject: CBReject, lpiCall: CBLpiCall): Promise<void>;
  prolog(resolve: CBResolve<CBIpcAnswer>, reject: CBReject, statement: CBStatement): Promise<void>;
  why(resolve: CBResolve<CBIpcAnswer>, reject: CBReject): Promise<void>;
  cd(resolve: CBResolve<CBIpcAnswer>, reject: CBReject, modulePath?: CBModulePath): Promise<void>;
  pwd(resolve: CBResolve<CBIpcAnswer>, reject: CBReject): Promise<void>;
  lm(resolve: CBResolve<CBIpcAnswer>, reject: CBReject, modulePath?: CBModulePath): Promise<void>;
  ls(resolve: CBResolve<CBIpcAnswer>, reject: CBReject, className?: CBClassName): Promise<void>;
  mkdir(resolve: CBResolve<CBIpcAnswer>, reject: CBReject, moduleName: CBModuleName): Promise<void>;
  who(resolve: CBResolve<CBIpcAnswer>, reject: CBReject): Promise<void>;
  sub(resolve: CBResolve<CBIpcAnswer>, reject: CBReject): Promise<void>;
  show(resolve: CBResolve<CBIpcAnswer>, reject: CBReject, objectName: CBObjectName): Promise<void>;
}
```

## 6.2 CBServer public protocol updates

Target public contract for `CBServer` (final):

```ts
export interface ICBServerPublic {
  // lifecycle
  initialize(resolve: CBResolve<void>, reject: CBReject): Promise<void>;
  start(): void;
  stop(): void;
  requestShutdown(): void;

  // status/observability
  subscribeStatus(
    resolve: CBResolve<ihsm.Disposable>,
    reject: CBReject,
    listener: StatusListener,
  ): Promise<void>;
  subscribeProcessIo(
    resolve: CBResolve<ihsm.Disposable>,
    reject: CBReject,
    listener: ProcessIoListener,
  ): Promise<void>;
  getCurrentStateName(resolve: CBResolve<string>, reject: CBReject): Promise<void>;

  // connection factory (only creation API)
  createConnection(
    resolve: CBResolve<ICBConnection>,
    reject: CBReject,
    options?: ICBConnectionOptions,
  ): Promise<void>;
}
```

Methods to **keep** (existing behavior retained):

- `initialize`
- `start`
- `stop`
- `requestShutdown`
- `subscribeStatus`
- `subscribeProcessIo`
- `getCurrentStateName`

Methods to **add**:

- `createConnection(resolve, reject, options?)`
  - allowed only when server is in ready/running state
  - returns a `CBConnection` instance
  - failure modes:
    - server not running/ready
    - server shutting down/stopping
    - connection bootstrap/connect failure
- `subscribeProcessIo(resolve, reject, listener)`
  - returns an `ihsm.Disposable`
  - listener receives complete lines with stream tag (`"stdout"` or `"stderr"`)
  - server keeps a subscriber set internally; disposing removes the listener

Methods to **remove** from `CBServer` public API:

- all command execution methods (`tell`, `untell`, `retell`, `tellModel`, `ask`, `hypoAsk`, `lpicall`, `prolog`, `why`, `cd`, `pwd`, `lm`, `ls`, `mkdir`, `who`, `sub`, `show`)
- `executeCommand`
- `listConnections`
- `closeConnection`
- `unsubscribeStatus`

Why this split:

- `CBServer` remains a pure lifecycle + factory actor.
- `CBConnection` is the only command surface.
- Connection destruction is owned only by `CBConnection.close()`.
- `CBServer` owns an internal `Map<connectionId, ConnectionActorRef>` for supervision.
- `CBServer` owns internal line buffers + subscriber set for process IO fan-out.

## 6.3 Connection options

```ts
export interface ICBConnectionOptions {
  label?: string;                 // diagnostics tag
  timeoutMs?: number;             // per-command timeout; default from config
  autoConnect?: boolean;          // default true
  startupProbeCommand?: "pwd" | "who"; // optional probe right after connect
}

// CBServer public signature (typed):
// createConnection(
//   resolve: CBResolve<ICBConnection>,
//   reject: CBReject,
//   options?: ICBConnectionOptions
// ): Promise<void>;
```

## 7. State Machine Spec

## 7.1 CBServerActor states

```text
CBServerTop
* Uninitialized [initial]
- Initialized
  - ProcessDetached
    * Stopped [initial]
    - ShuttingDown
  - ProcessObserving
    - Starting
    - Running
      * Ready [initial] (accepts createConnection)
    - Stopping
  - ProcessDetaching
  - FatalErrorState
```

Invariants by state/composite:

- `CBServerTop` (composite): no additional context invariants; valid across all descendants.
- `Uninitialized` (leaf): process is disarmed; no pid/subscription/timer; `killSignaled=false`.
- `Initialized` (composite): configuration and mailbox references are initialized and non-null.
- `ProcessDetached` (composite): process resources are disarmed (no live process subscription, no active pid, no active kill timer).
- `Stopped` (leaf): detached invariants hold; request/connection command execution is rejected.
- `ShuttingDown` (leaf): detached invariants hold; command execution is rejected with shutdown-specific error.
- `ProcessObserving` (composite): process observations may arrive; bytes from `stdout`/`stderr` are buffered and emitted line-by-line to IO subscribers.
- `Starting` (leaf): either fully unarmed (pre-spawn) or pid+subscription both present; children not armed.
- `Running` (composite): process is armed; server mailbox exists; connections can be created only in `Ready`.
- `Ready` (leaf): running invariants hold; `createConnection` is accepted; active connection table remains internally consistent; IO subscription dispatch remains active.
- `Stopping` (leaf): stop sequence in progress; new connections/commands rejected; kill-grace logic active when needed.
- `ProcessDetaching` (leaf): awaiting child/port detachment completion before transition to `Stopped`/`ShuttingDown`.
- `FatalErrorState` (leaf): terminal fault state; no normal command surface allowed.

Key transitions:

- `start` in `Stopped` -> `Starting`
- successful spawn/ready -> `Running.Ready`
- `stop` in running -> `Stopping`
- process exit/error -> `ProcessDetaching` -> `Stopped` or `ShuttingDown`

Responsibilities in `Running.Ready`:

- accept `createConnection`
- track active connection IDs for internal supervision only
- reject start/stop misuse with explicit messages

## 7.2 CBConnectionActor states

```text
CBConnectionTop
* Uninitialized [initial]
- Initialized
  * Disconnected [initial]
  - Connecting
  - Connected
    * Idle [initial]
    - RequestProcessing
    - Writing
    - Reading
  - Closing
  - Closed
  - FatalErrorState
```

Invariants by state/composite:

- `CBConnectionTop` (composite): no additional invariants beyond protocol typing.
- `Uninitialized` (leaf): no active transport/session resources; no active request.
- `Initialized` (composite): connection context is initialized and bound to owning server.
- `Disconnected` (leaf): no socket/session; queue empty; active request undefined.
- `Connecting` (leaf): transport connect attempt in flight; no command execution accepted until success.
- `Connected` (composite): transport/session is established and healthy.
- `Idle` (leaf): connected invariants hold; no active request; outbound/inbound buffers empty.
- `RequestProcessing` (leaf): queue non-empty; active request selected; exactly one in-flight request lifecycle.
- `Writing` (leaf): active request defined; outbound frame exists and is being sent.
- `Reading` (leaf): active request defined; awaiting/parsing reply for the same request.
- `Closing` (leaf): teardown in progress; reject new commands; settle/reject pending work exactly once.
- `Closed` (leaf): no active socket subscription; queue empty; active request undefined.
- `FatalErrorState` (leaf): terminal protocol/transport failure; no normal command surface allowed.

Behavior:

- `initialize` -> `Disconnected`
- `connect` (implicit on first command or explicit) -> `Connecting` -> `Connected.Idle`
- `executeCommand` in `Idle` enqueues and transitions to processing
- strict FIFO, one active request
- transport failures reject active + pending, then transition `Closing` -> `Closed`

## 8. Invariants

## 8.1 Server invariants

- In detached states: no process subscription, no kill timer, no live process pid.
- In observing states: process subscription and pid must both be set.
- In ready state: process is armed and server mailbox exists.
- Active connections map is consistent with spawned child actor refs.
- Process IO subsystem maintains per-stream partial-line buffers and emits only complete lines to subscribers.

## 8.2 Connection invariants

- `Idle`: queue empty or waiting, no active write/read buffer.
- `RequestProcessing/Writing/Reading`: active request is defined.
- `Closed`: no active socket subscription, queue empty, active undefined.
- No callback resolve/reject can fire twice.

## 9. Command Encoding / Reply Parsing

- Keep a single command builder module used only by connection actor.
- Preserve existing command method surface but route through one encoder.
- Reply parser returns `IpcAnswer` with canonical completion mapping.
- Treat malformed frames/replies as connection failure with explicit error class.

## 10. Error Model

Typed errors:

- `CBServerNotRunningError`
- `CBServerStartError`
- `CBConnectionClosedError`
- `CBConnectionTimeoutError`
- `CBProtocolError`
- `CBTransportError`

Rules:

- command submitted to closed connection rejects immediately.
- transport loss rejects active + pending with `CBTransportError`.
- server stop initiates process shutdown; each connection transitions to closed on transport loss.

## 11. Configuration Changes

Add to `ICBServerMmkitSettings`:

- `connectionTimeoutMs: number` (default e.g. `4000`)

## 12. Test Strategy

## 12.1 Server actor tests (`test/cbserver/server/*.test.ts`)

- lifecycle only: init/start/stop/shutdown
- create/close connection orchestration
- process fault handling
- connection cleanup on stop
- process IO tests: stdout/stderr line splitting, partial-chunk accumulation, and subscriber disposal behavior

## 12.2 Connection actor tests (`test/cbserver/connection/*.test.ts`)

- mock transport unit tests:
  - connect/disconnect
  - queue drain
  - write/read failures
  - timeout behavior
  - parser failures

## 12.3 Integration tests (`test/cbserver/integration/*.real.test.ts`)

Mandatory precheck:

- run under `nix develop .#mmkit`
- marker `.nix-develop-shell` must exist
- marker removed on shell exit (shell hook trap)

Real smoke stage:

- verify `cbserver` executable exists (`MMKIT_REAL_CBSERVER_BIN`)
- verify server starts with explicit port and `-sm master`

Roundtrip stage:

- create connection
- `tell` frame
- `ask` frame back
- assert semantic result contains inserted object
- run sequential and burst queues

## 12.4 Transport matrix

- TCP real integration: required, blocking

## 13. Migration Plan

Phase 1:

- introduce `CBConnectionActor` and protocol types
- move command queue + parser logic from `CBServerActor` to connection actor
- keep adapter path for compatibility

Phase 2:

- remove command methods from server protocol
- add `createConnection` APIs everywhere
- update call sites

Phase 3:

- split tests by server vs connection
- add real integration test suite using `.#mmkit`

Phase 4:

- remove compatibility shims
- finalize docs and examples

## 14. Documentation Updates Required

- `components/mmkit/packages/server/test/cbserver/README.md`
  - required shell `nix develop .#mmkit`
  - marker lifecycle requirements
  - smoke commands before running full suite
- add new `components/mmkit/packages/server/src/cbserver/CONNECTION.md`
  - protocol/state/invariant summary
- update user-facing config docs for connection timeout and TCP behavior

## 15. Acceptance Criteria

Implementation is complete when:

- `CBServerActor` no longer owns command execution methods.
- `createConnection` is the only way to execute commands.
- `CBServerActor` has no public API to close or destroy connections.
- `CBConnection.close()` is the only supported connection destruction path.
- connection actor guarantees serial command execution + typed failures.
- `nix develop .#mmkit` is required and documented for real tests.
- TCP real roundtrip tests pass consistently.

## 16. Open Decisions (must be resolved before coding starts)

- Keep lazy connect (on first command) or explicit `connect()` API?
- Temporary compatibility layer duration (one release or immediate break)?

---

This plan is intentionally implementation-ready for AI-agent execution.