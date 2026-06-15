# Event coverage and consolidation analysis

Maps every Node.js `ChildProcess` / stdio and `net.Socket` subscription in cbserver to ihsm notifications and state handlers. Includes an event-storming pass for gaps and a slimming plan (merge duplicates, drop dead notifications).

**Handler codes:** **B** = behaviour, **E** = empty swallow, **U** = unhandled fatal (see [STATE-MACHINE-REPORT.md](./STATE-MACHINE-REPORT.md)).

## Wiring locations

All Node I/O subscriptions live in ports only:

| Port | Role |
|------|------|
| [`CBServerPort`](./actors/server/CBServerPort.ts) | `bindChildProcess` |
| [`CBCommandChannelPort`](./actors/commandChannel/CBCommandChannelPort.ts) | `open`, `bindTcpSocket` |
| [`CBNotificationChannelPort`](./actors/notificationChannel/CBNotificationChannelPort.ts) | `open`, `bindTcpSocket` |
| [`tcpPortProbe`](./actors/server/tcpPortProbe.ts) | startup TCP poll |

## Architecture — two I/O pipelines

```text
ChildProcess (cbserver)                    net.Socket × 2 per connection
        │                                           │
 CBServerPort.bindChildProcess              ChannelPort.bindTcpSocket
        │ onStdout*/onStderr*/onProcess*            │ onSocket*
        ▼                                           ▼
 CBServerActor (ProcessObserving…)         Command/NotificationChannelActor
        │ forward stdio                             │ reader.onData / writer.write
        ▼                                           ▼
 Stdout/StderrLogReader                     CBConnectionReader/Writer
        │ onStdoutLine/onStderrLine                 │ onReaderAnswer / onWriteComplete
        ▼                                           ▼
 processIoEvents (public API)              IPC queue → client promises
```

---

## Event storming — domain events

### Process lifecycle (supervisor)

| Domain event | Node source | ihsm notify | Handler verdict |
|--------------|-------------|-------------|-----------------|
| Process spawned | `child.once("spawn")` | `onSpawn` | **E** everywhere — redundant with `spawn()` Promise |
| Stdout chunk | `stdout.on("data")` | `onStdoutData` | **B** in `ProcessObserving` → log reader |
| Stdout EOF | `stdout.once("end")` | `onStdoutEnd` | **B** → log reader `onEnd` |
| Stdout closed | `stdout.once("close")` | `onStdoutClose` | **B** → log reader `onStreamClose` |
| Stdout error | `stdout.once("error")` | `onStdoutStdioError` | **B** → log reader `onStreamError` |
| (same for stderr) | stderr stream | `onStderr*` | mirror stdout |
| Process exited | `child.once("exit")` | `onProcessExit` | **B** — teardown driver |
| Process closed | `child.once("close")` | `onProcessClose` | **B** partial — only `recordLastExit` |
| Spawn failed | `child.once("error")` | `onProcessError` | **B** — abort / `doCompleteStop` |
| IPC channel lost | `child.once("disconnect")` | `onDisconnect` | **B** — abort / `doCompleteStop` |
| Log line ready | log reader internal | `onStdoutLine` / `onStderrLine` | **B** in `ProcessObserving` only |
| Log reader ack | log reader `postInterrupted` | `on*LogReaderInterrupted` | **B** in `ProcessDetaching` (decrements `pendingLogReaderInterrupts`) |
| Kill grace timer | port `setTimeout` | `onKillGraceElapsed` | **B** in `Terminating` → SIGKILL (swallowed in `ProcessDetaching`) |

**Not wired (intentional):** `child.stdin` (piped, never read/written), `child.on("message")`, `process.send` IPC.

### TCP client socket (per channel)

| Domain event | Node source | ihsm notify | Handler verdict |
|--------------|-------------|-------------|-----------------|
| Connect OK | `socket.connect(cb)` | `onSocketConnect` | **E** — state already advanced in `doConnect` |
| Connect fail | `once("timeout")` / `once("error")` pre-bind | (Promise reject) | **B** → `doBreakTransport` via catch |
| Bytes received | `socket.on("data")` | `onSocketData` | **B** → `reader.onData` |
| Socket drained | `socket.on("drain")` | `onSocketDrain` | **E** — write uses callback, not drain |
| Peer half-close | `socket.once("end")` | `onSocketEnd` | **B** or forward to `reader.onEnd` when reading |
| Socket closed | `socket.once("close")` | `onSocketClose` | **B** / forward when reading |
| Socket error | `socket.on("error")` | `onSocketError` | **B** → `doBreakTransport` |
| Idle timeout | `socket.on("timeout")` | `onSocketTimeout` | **B** → `doBreakTransport` |
| Write finished | `socket.write(cb)` | (writer `onWriteComplete`) | **B** — not a socket listener |

**Not wired (not needed for client):** `listening`, `connection`, `lookup`, `ready`, `pause` / `resume`.

### Reader / writer (synthetic, not Node listeners)

| Event | Posted by | Purpose |
|-------|-----------|---------|
| `reader.onAnswerReady` | reader after parse | channel `onReaderAnswer` |
| `reader.onEnd` | channel on socket end/close | complete await |
| `writer.onWriteComplete` / `onWriteFailed` | writer after `port.write` | advance IPC pipeline |
| `reader/writer interrupt` | channel `doDispatchInterrupt` | detach TCP children |

**Dead path:** `reader.onStreamClose` — implemented on `ReaderIdle` but TCP channels post `onEnd` instead; only stdio log readers use `onStreamClose`.

---

## Coverage verdict

### ChildProcess + stdio: complete for observed I/O

All events subscribed in `bindChildProcess` have ihsm handlers on every reachable state (**B**, **E**, or terminal swallow). Stdin is the only piped stream without handlers — acceptable unless we need to feed the Java process.

### TCP socket: complete for client usage

All failure and data paths are covered. `drain` and post-connect `onSocketConnect` are subscribed/posted but intentionally **E** in actors — candidates to remove from the port to slim code and Config facets.

### Gaps (events that can still crash or confuse)

| Gap | Severity | Fix |
|-----|----------|-----|
| `onStdoutLine` / `onStderrLine` only on `ProcessObserving` | Medium | **E** on `Initialized` / `ProcessDetached` |
| `on*LogReaderInterrupted` only on `ProcessDetaching` | Low | **E** on `ProcessDetached`, `SpawnPending`, `SpawnArmed` |
| `onConnectionChildClosed` only on `ProcessActive` | Low | **E** on detached states if late close notify |
| `ReaderAwaiting` lacks `onStreamClose` | Low | **E** swallow or document TCP uses `onEnd` only |
| `exit` + `close` both call `detach()` | Info | First wins; second guarded — OK |
| `onProcessClose` vs `onProcessExit` duplicate | Info | Could drop `onProcessClose` notify from port |

### Event-storming — events not yet in the model

| Candidate event | Need? | Notes |
|-----------------|-------|-------|
| `stdinWritable` / backpressure | No | cbserver is outbound-only today |
| `socketHalfOpen` | No | covered by `end` + `close` |
| Connection reset before enroll | Yes | covered by connect error + break transport |
| Partial frame timeout (read stall) | Partial | socket idle timeout only when `socketTimeoutMs > 0` |
| Supervisor parent SIG* | Partial | kills tracked children, not ihsm |
| Flux / extension host dispose | Out of scope | host calls `stop()` |

---

## Consolidation and slimming plan

### High impact (~250+ lines)

1. **`CBTcpChannelPort` base class** — merge `CBCommandChannelPort` and `CBNotificationChannelPort` (124 lines × 2; diff is type names only). Thin subclasses or factory `createTcpChannelPort(top, spawnTcpChildren)`.

2. **`ProcessLogReaderActor` parameterized by stream** — merge stdout/stderr actors, contexts, configs, invariants (~300 lines × 2). Single `stream: "stdout" | "stderr"` drives notify names. Keep separate only if ihsm config generation cannot parameterize notify facet names.

3. **`ChannelSocketTerminal` composite** — `CommandTerminal` and `NotificationTerminal` each repeat ~80 lines of identical no-op handlers. Share one parent class.

### Medium impact

4. **Remove dead port → actor notifications**
   - Stop posting `onSocketConnect` after `open()` (handler is always **E**).
   - Stop posting `onSocketDrain` (never used for flow control).
   - Stop posting `onSpawn` (spawn completion is synchronous in `port.spawn`).
   - Consider merging `onProcessClose` into `onProcessExit` only.

   Saves Config facet entries, handler methods, and port lines.

5. **Unify stdio forward in supervisor** — `ProcessObserving` has eight nearly identical methods. A private `forwardStdio(stream, kind, payload)` only if it stays readable; otherwise keep explicit methods for ihsm trace clarity.

6. **Delete `CBConnectionPort.ts` re-export** — importers use command/notification port directly.

### Small types / routines — keep vs remove

| Symbol | Verdict | Why |
|--------|---------|-----|
| `CBCommandChannelSocketWrite` / `Notification…` | **Merge** → `CBTcpSocketWrite` | Identical `Pick<write>` |
| `CommandInbound` type alias | **Remove** | Inline `InboundActor<Config>` once per port |
| `childStillRunning` in port | **Keep** | Non-obvious detach kill guard |
| `readPositiveInt` in `SpawnArmed` | **Inline or settings util** | Single use |
| `tcpPortProbe` vs channel `open()` | **Keep separate** | Probe is stateless retry; channel is long-lived |
| `formatTcpLengthFrame` in tests | **Keep** | Paired with parser |
| `waitForConnectionBootstrap` etc. | **Keep** | Cross-actor sync |
| `bridgeCommandAnswer` | **Keep** | Orchestrator promise wiring |

### Design clarity (without more code)

- Document stdio pipeline in `CBServerPort`: port → supervisor → log reader → line notify → `processIoEvents`.
- Document socket pipeline in channel base: port → `onSocketData` → reader → IPC → writer → `port.write`.
- Drop redundant notifications so Config facets list only events that change state.

### Estimated line reduction

| Change | Approx. lines |
|--------|---------------|
| Shared TCP port | −120 |
| Shared log reader | −280 |
| Shared terminal swallow layer | −100 |
| Remove dead notifications + handlers | −60 |
| **Total** | **~560** (~15% of actor tree) |

---

## Summary

| Area | Rating | Notes |
|------|--------|-------|
| Process events | Good | All subscribed events handled; stdin intentionally unused |
| Socket events | Good | All paths covered; 2–3 dead notifications |
| Late-event safety | Fair | Log lines and interrupt acks can **U** after detach |
| Duplication | High | Channel ports, log readers, terminal swallows |
