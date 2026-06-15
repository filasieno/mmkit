# CBServer actor handler matrix

Authoritative reference for **every state**, **every handler**, and **what must happen** when an
event arrives in the wrong phase. Invariant predicates live in `*Invariants.ts`; each leaf state's
`_checkInvariant()` delegates to exactly one `assert*` function documented there.

**Source files:** `src/cbserver/actors/**/{*Actor.ts,*Invariants.ts}`

---

## Legend

| Code | Meaning |
|------|---------|
| **specific** | Handler runs real logic in this state (may transition). |
| **→parent** | No override in this state; ihsm dispatches to the parent class implementation. |
| **noop** | Override exists; body is empty or only `_checkInvariant()` — **absorbs** late events during teardown races. |
| **throw** | `throw new Error(...)` — programming error or illegal client call for this phase. |
| **defer** | Sets a flag (`closed`, `closeRequested`, …) without transitioning; completion happens when in-flight work finishes. |
| **unhandled** | *Not used.* We never call `unhandled()`. Missing handlers in non-terminal states are bugs; terminal states use **noop** absorbers instead. |

**Facet convention (ihsm Config bag):**

| Facet | Protocol | Access |
|-------|----------|--------|
| `call` | services | `actor.call.*` — async RPC from clients/tests |
| `notify` | notifications | `actor.notify.*` — external sync events |
| `internal` | internalNotifications | `actor.notifyNow.*` / port callbacks — choreography |

**Invariant discipline:** Every handler that mutates `ctx` must call `_checkInvariant()` first.
Violations throw `invariant violation [<StateName>]: …` and expose the leaf state whose context
bag no longer matches its phase.

---

## 1. CBServerTop (supervisor)

**Actor:** `actors/server/CBServerActor.ts`  
**Invariants:** `actors/server/CBServerInvariants.ts`

### State hierarchy

```text
CBServerTop
├── Uninitialized (*)
└── Initialized
    ├── ProcessDetached (*)
    │   ├── Stopped (*)
    │   └── ShuttingDown
    ├── ProcessDetaching
    └── ProcessObserving
        ├── Starting (*)
        │   ├── SpawnPending (*)
        │   ├── SpawnArmed
        │   └── TcpConnecting
        └── ProcessStdioForwarding (mixin)
            └── ProcessActive
                ├── Running (*)
                ├── Stopping
                └── Terminating
```

### Invariants (leaf states)

| State | What must be true | Why |
|-------|-------------------|-----|
| **Uninitialized** | No mailbox, no process, no log readers | Pre-`initialize()` — no public API except `initialize`. |
| **Stopped** | Initialized + process disarmed + no kill timer | Clean idle; `start()` allowed. |
| **ShuttingDown** | Stopped shape + `shutdownRequested` | Terminal shutdown; no `start()`. |
| **ProcessDetaching** | Process cleared; kill timer cleared | Async log-reader interrupt in flight. |
| **SpawnPending** | Starting + no pid + no log readers | OS spawn in progress. |
| **SpawnArmed** | Starting + pid/subscription armed | Awaiting `doBeginStartup` / log reader arm. |
| **TcpConnecting** | Starting + log readers armed | TCP probe loop before `Running`. |
| **Running** | Process active + mailbox set | Accepts `createConnection`. |
| **Stopping** | Process active | Phase 1 stop: close connections before SIGTERM. |
| **Terminating** | Process active | Phase 2 stop: SIGTERM + kill grace timer. |

### Handler matrix

| Handler | Facet | Uninitialized | Initialized subtree | ProcessDetaching | ProcessObserving | SpawnPending | SpawnArmed | TcpConnecting | Running | Stopping | Terminating |
|---------|-------|---------------|---------------------|------------------|------------------|--------------|------------|---------------|---------|----------|-------------|
| `initialize` | call | **specific** → `CBServerInitializeRequest` (wires mailbox, transitions to `Stopped`) | — | — | — | — | — | — | — | — | — |
| `subscribeStatus` / `subscribeProcessIo` / `getCurrentStateName` | call | — | **specific** | →parent | →parent | →parent | →parent | →parent | →parent | →parent | →parent |
| `createConnection` | call | — | **throw** illegal state | →parent | →parent | →parent | →parent | →parent | **specific** | →parent throw | →parent throw |
| `requestShutdown` | notify | — | **specific** | →parent | →parent | →parent | →parent | →parent | →parent | →parent | →parent |
| `start` | notify | — | **noop** | →parent | →parent | →parent | **specific** (Stopped only) | →parent noop | →parent noop | →parent noop | →parent noop |
| `stop` | notify | — | **noop** | →parent | **specific** → Stopping | →parent | →parent | →parent | →parent | →parent noop | →parent noop |
| `onStdoutLine` / `onStderrLine` | internal | — | **noop** swallow | →parent | **specific** emit | →parent | →parent | →parent | →parent | →parent | →parent |
| `onConnectionChildClosed` | internal | — | **noop** | →parent | →parent noop | →parent | →parent | →parent | →parent | **specific** re-pump | →parent noop |
| `onStdout/StderrLogReaderInterrupted` | internal | — | **noop** | **specific** note + finalize | →parent noop | →parent | →parent | →parent | →parent | →parent | →parent |
| `onKillGraceElapsed` | internal | — | **noop** | **noop** | →parent | →parent | →parent | →parent | →parent | →parent | **specific** SIGKILL |
| Stdio port events (`onStdoutData`, …) | internal | — | — | — | — | **specific** → readers | **noop** drop | **specific** → readers | →parent | →parent | →parent |
| `onProcessExit` / `Error` / `Disconnect` | internal | — | — | — | **specific** record | — | **specific** abort start | **specific** abort | **specific** → doCompleteStop | →parent | →parent |
| `doSpawnLogReaders` | internal | — | — | — | **specific** | →parent | →parent | →parent | →parent | →parent | →parent |
| `doBeginDetach` / `doCompleteStop` | internal | — | — | **specific** | **specific** | →parent | →parent | →parent | →parent | →parent | →parent |
| `doStart` / `onFailToStart` | internal | — | — | — | — | **specific** | →parent | →parent | →parent | →parent | →parent |
| `doBeginStartup` | internal | — | — | — | — | →parent | **specific** | →parent | →parent | →parent | →parent |
| `doTcpPortProbeStep` / `onTcpPortProbeRetry` | internal | — | — | — | — | →parent | →parent | **specific** | →parent | →parent | →parent |
| `doCloseAllConnections` | internal | — | — | — | — | →parent | →parent | →parent | →parent | **specific** | →parent |
| `doSendSigterm` | internal | — | — | — | — | →parent | →parent | →parent | →parent | →parent | **specific** |

**Brutal failure rule:** `createConnection` outside `Running` throws immediately — never queues work.
`start()` outside `Stopped` is a **noop** (not an error) so duplicate starts are harmless.

---

## 2. CBConnectionTop (connection orchestrator)

**Actor:** `actors/connection/CBServerConnectionActor.ts`  
**Invariants:** `actors/connection/CBServerConnectionInvariants.ts`

### State hierarchy

```text
CBConnectionTop
* ConnectionBootstrap
  * Connecting (* — auto-starts `doSpawnChannels` on spawn)
- ConnectionBase (operational branch; leaf states assert)
- ConnectionIdle
├── ConnectionClosing
└── ConnectionTerminal
    ├── ConnectionClosed
    └── ConnectionBroken
```

### Invariants (leaf states)

| State | What must be true | Why |
|-------|-------------------|-----|
| **Connecting** | `!closed`, connectionId set, channels not spawned | Bootstrap in progress (`doSpawnChannels` on spawn). |
| **ConnectionIdle** | Both channels spawned + enrolled, `!closed` | IPC bridge active. |
| **ConnectionClosing** | `closed === true` | `close()` taken; awaiting channel CANCEL_ME. |
| **ConnectionClosed** | Terminal + no `brokenReason` + both channels closed | Graceful shutdown. |
| **ConnectionBroken** | Terminal + non-empty `brokenReason` | Abnormal termination. |

### Handler matrix

| Handler | Facet | Connecting | ConnectionBase | ConnectionIdle | ConnectionClosing | ConnectionTerminal | ConnectionClosed | ConnectionBroken |
|---------|-------|------------|----------------|----------------|-------------------|-------------------|------------------|------------------|
| `getConnectionId` | call | — | **specific** | →parent | →parent | →parent | →parent | →parent | →parent |
| `getClientId` / `getNotificationClientId` | call | — | **throw** if ctx missing | →parent | →parent | →parent | →parent | →parent | →parent |
| `close` | notify | — | **throw** not ready | →parent | **specific** → Closing | **noop** | **noop** | →parent | →parent |
| IPC commands (`tell`, `ask`, `pwd`, …) | call | — | **throw** via `rejectCommand` | →parent throw | **specific** enqueue | →parent throw | **throw** closed/broken | →parent throw | **throw** broken |
| `doBreakTransport` | internal | — | **specific** → Broken | →parent | →parent | →parent | →parent | →parent | →parent |
| `doFinalizeClose` | internal | — | **specific** → Closed/Broken | →parent | →parent | →parent | →parent | →parent | →parent |
| `doProcessCommandQueue` / `doCloseAfterDrain` | internal | — | **noop** absorb | →parent | **specific** (Idle) | →parent noop | →parent noop | →parent noop | →parent noop |
| `onCommand/NotificationChannelClosed` | internal | — | **specific** finalize | →parent | →parent | →parent | →parent | →parent | →parent |
| `onCommand/NotificationChannelBroken` | internal | — | **specific** → Broken | →parent | →parent | →parent | →parent | →parent | →parent |
| `doSpawnChannels` | internal | **specific** → Idle | →parent | — | — | — | — | — |

**Brutal failure rule:** Any IPC `call` in `ConnectionBase` (inherited by Connecting before channels
ready) throws `"connection is not ready"`. Terminal states throw `"connection is closed"` or
`"connection is broken"`.

---

## 3. CBCommandChannelTop (command TCP channel)

**Actor:** `actors/commandChannel/CBCommandChannelActor.ts`  
**Invariants:** `actors/commandChannel/CBCommandChannelInvariants.ts`

### State hierarchy

```text
CBCommandChannelTop
* CommandBootstrap
  * CommandConnecting (* — auto-starts TCP connect on spawn)
- CommandChannelBase
├── CommandTransport
│   ├── CommandSession
│   │   └── CommandIdle (*)
│   ├── RequestProcessing
│   │   ├── Writing
│   │   └── Reading
│   └── CommandClosing
└── CommandTerminal
    ├── CommandDetaching
    ├── CommandClosed
    └── CommandBroken
```

### Invariants (leaf states)

| State | What must be true | Why |
|-------|-------------------|-----|
| **CommandConnecting** | `!closed`, connectionId, `!enrolled` | TCP connect + child spawn on actor spawn. |
| **CommandIdle** | Session + no active request + empty queue | Ready for next `dispatch*`. |
| **Writing** | RequestProcessing + activeRequest + pendingFrame | Bytes in flight to socket. |
| **Reading** | RequestProcessing + activeRequest | Awaiting ipcanswer. |
| **CommandClosing** | Transport + `closed` | CANCEL_ME in progress. |
| **CommandClosed** | Terminal + children disarmed + no brokenReason | Graceful. |
| **CommandBroken** | Terminal + brokenReason set | Abnormal. |

### Handler matrix (selected; CommandChannelBase defaults)

| Handler | Facet | Base / not-ready | Connecting | CommandIdle | RequestProcessing | Writing | Reading | CommandClosing | CommandTerminal* |
|---------|-------|------------------|------------|-------------|-------------------|---------|---------|----------------|------------------|
| `getRawClientId` | call | **specific** | →parent | →parent | →parent | →parent | →parent | →parent | →parent |
| `close` | notify | **throw** not ready | →parent | **specific** → Closing | **defer** `closed=true` | →parent | →parent | **noop** | **noop** |
| `dispatch*` (all IPC) | notify | **throw** rejectCommand | →parent | **specific** dispatchIpc | →parent | →parent | →parent | →parent | Closed/Broken: **throw** |
| Socket events | internal | Base: route/break | →parent | →parent | →parent | →parent | Reading: **override** end/close | →parent | **noop** absorb |
| `doConnect` / `doSpawn` / `doBeginEnroll` | internal | — | **specific** | — | — | — | — | — | **noop** |
| `doProcessNext` / `doWriteActive` / `doReadActive` / `doReadComplete` / `doFailActive` | internal | — | — | — | **specific** pipeline | →parent | →parent | →parent | **noop** |
| `doBreakTransport` / `doFinalizeClose` | internal | **specific** | →parent | →parent | →parent | →parent | →parent | onEntry | **noop** |

\* **CommandTerminal** and subclasses override ~15 internal handlers as **noop** absorbers so late
reader/writer/socket events during detach never surface as `UnhandledEventError`.

**Brutal failure rule:** `dispatch*` while not enrolled throws. `close()` during **Reading** does
**not** throw — it **defers** (`ctx.closed = true`) so STOP_SERVER races complete gracefully.

---

## 4. CBNotificationChannelTop (notification TCP channel)

**Actor:** `actors/notificationChannel/CBNotificationChannelActor.ts`  
**Invariants:** `actors/notificationChannel/CBNotificationChannelInvariants.ts`

### State hierarchy

```text
CBNotificationChannelTop
* NotificationBootstrap
  * NotificationConnecting (* — auto-starts TCP connect on spawn)
- NotificationChannelBase
- NotificationTransport
│   ├── NotificationEnrolling
│   ├── NotificationEnrollReading
│   ├── NotificationSession
│   │   ├── NotificationIdle (*)
│   │   └── NotificationAwaiting
│   └── NotificationClosing
└── NotificationTerminal
    ├── NotificationDetaching
    ├── NotificationClosed
    └── NotificationBroken
```

### Invariants (leaf states)

| State | What must be true | Why |
|-------|-------------------|-----|
| **NotificationIdle** | Session + no active enroll request + empty queue | Ready for `beginGetNotification`. |
| **NotificationAwaiting** | Session + `pendingNotification` waiter | Long-poll blocked on server push. |
| **NotificationClosing** | Transport + `closed` | CANCEL_ME in progress. |
| **NotificationClosed** / **Broken** | Same pattern as command channel | Terminal outcomes. |

### Handler matrix (selected)

| Handler | Facet | Base | NotificationIdle | NotificationAwaiting | NotificationClosing | Terminal* |
|---------|-------|------|------------------|------------------------|---------------------|-----------|
| `close` | notify | **throw** not ready | **specific** → Closing | **specific** settle waiter + finalize | **noop** | **noop** |
| `beginGetNotification` | notify | **throw** not ready | **specific** dequeue or → Awaiting | →parent | →parent | Closed/Broken: **throw** |
| `onReaderNotification` / `onNotificationReady` | internal | Transport: queue | Idle: **specific** | Awaiting: **specific** resolve | →parent | **noop** |
| `doNotificationReadTimeout` | internal | — | — | **specific** | — | — |
| `doBreakTransport` | internal | **specific** → Broken (skips Detaching) | →parent | →parent | →parent | **noop** |
| `doFinalizeClose` | internal | **specific** → Closed | →parent | →parent | onEntry | **noop** |

**Brutal failure rule:** `beginGetNotification` on terminal states throws `"notification channel is
closed"`. `NotificationAwaiting.close()` settles the waiter with a synthetic timeout answer then
finalizes — never throws into `FatalErrorState`.

---

## 5. CBConnectionReaderTop (IPC frame reader)

**Actor:** `actors/reader/CBConnectionReaderActor.ts`  
**Invariants:** `actors/reader/CBConnectionReaderInvariants.ts`

### State hierarchy

```text
CBConnectionReaderTop
* ReaderInitialized
  * ReaderIdle
  - ReaderAwaiting
  - ReaderIgnored
    - ReaderStopped
```

### Handler matrix

| Handler | Facet | ReaderIdle | ReaderAwaiting | ReaderIgnored / Stopped |
|---------|-------|------------|----------------|-------------------------|
| `beginAwait` | notify | — | **specific** → Awaiting | →parent | **noop** |
| `interrupt` | notify | **specific** ack | **specific** → Stopped | →parent | →parent |
| `onData` / `onEnd` / `onStreamClose` / `onStreamError` | internal | — | **specific** spontaneous drain | **specific** parse answer | **noop** |
| `onAnswerReady` | internal | — | — | **specific** → Idle | — |

**Brutal failure rule:** `beginAwait` when not idle throws `"reader is not idle"`.

---

## 6. CBConnectionWriterTop (length-prefixed writer)

**Actor:** `actors/writer/CBConnectionWriterActor.ts`  
**Invariants:** `actors/writer/CBConnectionWriterInvariants.ts`

### Handler matrix

| Handler | Facet | WriterIdle | WriterSending | WriterIgnored / Stopped |
|---------|-------|------------|---------------|-------------------------|
| `sendFrame` | call | — | **specific** → Sending | →parent (in Sending) | **noop** |
| `interrupt` | notify | **specific** | **specific** → Stopped | →parent | →parent |
| `doWriteFrame` | internal | — | — | **specific** port.write | — |
| `onWriteComplete` / `onWriteFailed` | internal | — | — | **specific** → Idle | — |

**Brutal failure rule:** `sendFrame` when not idle throws `"writer is not idle"`.

---

## 7. StdoutLogReaderTop / StderrLogReaderTop (process log readers)

**Actors:** `CBServerStdoutLogReaderActor.ts`, `CBServerStderrReaderActor.ts`  
**Invariants:** `CBServerStdoutLogReaderInvariants.ts`, `CBServerStderrReaderInvariants.ts`

### State hierarchy (both)

```text
*LogReaderTop
* *Initialized (* — auto-starts on spawn)
  * *Idle (*)
  - *Stopped
```

### Handler matrix

| Handler | Facet | Idle | Stopped |
|---------|-------|------|---------|
| `interrupt` / `stop` | notify | interrupt: **specific**; stop: **noop** | **specific** → Stopped | →parent noop |
| `onData` / `onEnd` / `onStreamClose` / `onStreamError` | internal | — | **specific** emit lines | **noop** |

---

## Cross-cutting rules

1. **Terminal noop absorbers** — Late port/child events after interrupt or close must not throw
   `UnhandledEventError`. Terminal states (`*Terminal`, `*Stopped`, `*Ignored`) override handlers
   as **noop** with `_checkInvariant()` only.

2. **Defer vs throw on `close()`** — Command channel defers close during in-flight IPC;
   notification channel settles waiters then finalizes; connection orchestrator transitions to
   `ConnectionClosing`.

3. **No `unhandled()`** — If a handler is missing in a non-terminal state and no parent implements
   it, ihsm raises `UnhandledEventError`. That is treated as a **bug** to fix by adding an explicit
   override (usually **noop** or **throw**).

4. **Invariant before mutation** — Every handler that changes `ctx` calls `_checkInvariant()` first.
   Composite states (`ConnectionBase`, `CommandTransport`, `Initialized`) either delegate asserts to
   leaves or document why they intentionally skip asserts.

5. **Illegal API surface** — Client-facing `call` methods that are phase-gated use **throw** with a
   explicit message (`illegal state`, `not ready`, `channel is closed`, `connection is broken`).
   Silent acceptance of IPC in the wrong phase is forbidden.

---

## Maintenance

When adding a state or handler:

1. Add or extend `assert*` in the matching `*Invariants.ts` with **Why** and **How checked** prose.
2. Add `_checkInvariant()` on the leaf state class calling that assert.
3. Add a row to this document's handler matrix.
4. Decide explicitly: **specific**, **→parent**, **noop**, **throw**, or **defer** — never leave
   ambiguous.
