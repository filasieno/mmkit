# cbserver `shared/` — cross-actor modules

Code here is imported by **more than one** actor tree. Prefer colocating new code
under `actors/<name>/` when only that actor (or its spawn/port children) needs it.

| Module | Used by |
|--------|---------|
| `CBServerDefs.ts` | **server** (`CBServerActor`, `CBServerConfig`), **connection** (config, context, actor, handle), **commandChannel**, **notificationChannel**, **reader** — IPC answer types, `ICBConnection`, listeners |
| `cbIpcCatalog.ts` | **commandChannel**, **notificationChannel**, **reader** — method names, payload builders, notification detection |
| `CBTcpOptions.ts` | **connection** (context), **commandChannel**, **notificationChannel** (port + context) — host/port/timeouts for TCP children |
| `cbTrace.ts` | **server**, **connection**, **commandChannel**, **notificationChannel** — optional `CB_TRACE` debug logging |
| `cbActorSpawnOptions.ts` | cbserver spawn helpers + tests — ihsm trace/initialize defaults |

**Not in `shared/` (local to one actor):**

- `actors/server/settings/` — cbserver subprocess launch config (`CBServerSettings`, setting metadata)
- `actors/server/tcpPortProbe.ts` — startup TCP listen probe (`CBServerPort`)
- `actors/server/utils.ts` — server port spawn helpers (log readers, connection child)
- `actors/connection/spawnCommandChannel.ts`, `spawnNotificationChannel.ts` — connection orchestrator channel spawn
- `actors/connection/utils.ts` — connection client helpers (Java API parity)
- `actors/commandChannel/spawnCommandChannelTcpChildren.ts` — command socket reader/writer spawn
- `actors/notificationChannel/spawnNotificationChannelTcpChildren.ts` — notification socket reader/writer spawn
- `actors/reader/tcpFraming.ts` — length-prefixed frame parse/format for `CBConnectionReaderContext`
