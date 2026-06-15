# mmkit — Server-Centric Refactor Specification

**Version:** 1.1.0-draft  
**Status:** Approved direction — implementation in progress  
**Supersedes (partially):** DESIGN.md §12 (extension `ServerManager`), §19 docker-compose LSP launch, P13 observability stack in PLAN.md  
**Related:** [DESIGN.md](./DESIGN.md) · [CONFIGURATION.md](./CONFIGURATION.md) · [PLAN.md](./PLAN.md)

---

## Table of contents

1. [Summary](#1-summary)
2. [Rationale](#2-rationale)
3. [Goals and non-goals](#3-goals-and-non-goals)
4. [Target architecture](#4-target-architecture)
5. [Transport split: pure LSP + pure MCP](#5-transport-split-pure-lsp--pure-mcp)
6. [Naming](#6-naming)
7. [Startup: eager and fast](#7-startup-eager-and-fast)
8. [LSP custom protocol (JSON-RPC)](#8-lsp-custom-protocol-json-rpc)
9. [MCP server (Streamable HTTP)](#9-mcp-server-streamable-http)
10. [Server-side state machines](#10-server-side-state-machines)
11. [Extension client (thin shell)](#11-extension-client-thin-shell)
12. [Unified telemetry (OTEL + W3C context)](#12-unified-telemetry-otel--w3c-context)
13. [Configuration and property sheet](#13-configuration-and-property-sheet)
14. [Deletion list](#14-deletion-list)
15. [Test strategy migration](#15-test-strategy-migration)
16. [Implementation phases](#16-implementation-phases)
17. [Acceptance criteria](#17-acceptance-criteria)
18. [Risks and mitigations](#18-risks-and-mitigations)

---

## 1. Summary

Refactor mmkit so that **all operational logic** (mmkit server lifecycle, install
pipeline, MCP tools, OTEL export) lives in the **LSP server process**.
The VS Code extension becomes a **thin client**: settings, UI, LSP TCP transport,
and trace context propagation.

**Two separate wire protocols** on the same Node process:

| Surface | Transport | Purpose |
| ------- | --------- | ------- |
| **LSP** | TCP (`MMKIT_LSP_PORT`, default `16011`) | Language features + `mmkit/*` IDE control |
| **MCP** | Streamable HTTP on Express (`POST /mcp`, default `MMKIT_HTTP_PORT` `28080`) | AI agents, external MCP clients |

MCP is **never** multiplexed onto the LSP JSON-RPC stream. No shared-channel adapter.

The bundled **observability stack** (Docker Compose, Victoria*, Grafana, in-cluster
OTEL collector, mm devkit polling) is **removed**. Telemetry uses an **external
OTEL collector** configured in the property sheet. Client and server share the
same collector endpoint and propagate **W3C `traceparent` / `baggage`** for
unified traces.

**mmkit server** (user-facing name; implementation: ConceptBase cbserver process)
is **not** started at extension/LSP boot. It starts only on an **explicit client
command** that passes the full server configuration from the property sheet.

The **LSP process starts immediately** on extension activation (`onStartupFinished`),
before any document is opened.

---

## 2. Rationale

| Driver | Explanation |
| ------ | ----------- |
| **Single development surface** | Features (LSP, MCP, server control) are implemented once on the server; the extension does not duplicate ihsm actors for process/Docker/TCP. |
| **Protocol conformance** | LSP stays on LSP; MCP uses the official Streamable HTTP transport (`@modelcontextprotocol/express`). No custom demuxer or non-standard MCP framing. |
| **Hot-path isolation** | Document sync and semantic tokens are not blocked by MCP tool traffic or HTTP parsing. |
| **Unified telemetry** | Server and client export to the same OTLP endpoint; `traceparent`/`baggage` link UI actions to server work across both transports. |
| **Testability** | Server control, install pipeline, MCP tools, and integration tests run **headless against the server process** with sim ports — not through the VS Code extension host. |
| **Operational simplicity** | Removing the dev observability stack eliminates port matrices, compose lifecycle, and dual-container topology. |

### Why not a shared LSP channel + front adapter?

A single TCP socket multiplexing LSP and MCP saves one connection at startup but
forces a custom protocol, breaks `vscode-languageclient` compatibility for alien
JSON-RPC, and prevents conformant MCP Streamable HTTP (SSE push). **Pure dual
transport** wins on development efficiency, agent interoperability, and edit-path
latency. See architecture decision record in project chat (2026-06-07).

---

## 3. Goals and non-goals

### Goals

1. **ServerSupervisor** HSM in the LSP process, started at process boot.
2. **MmkitServerActor** HSM (internal name; manages cbserver binary/container) — explicit start/stop only.
3. **Custom LSP JSON-RPC handlers** (`mmkit/*`) for IDE server control — **not** MCP methods.
4. **MCP server** on Express Streamable HTTP (`/mcp`) in the same process, sharing `ServerSupervisor` state.
5. **LSP notifications** `mmkit/server/state` → extension updates status bar, panel, and trace correlation.
6. **Eager LSP start** on `onStartupFinished`; **TCP** transport (extension spawns server, connects via socket).
7. **Client OTEL** optional; same host/port/protocol as server; W3C context propagation.
8. **Move** server-manager unit tests, fault-injection tests, and server integration tests to `packages/lsp-server`.
9. **Rename** user-visible “cbserver” → **mmkit server** (settings keys keep `mmkit.server.*` for compatibility).

### Non-goals (this refactor)

- Full MCP tool catalog mapped from Java ConceptBase client API (follow-up; skeleton + `server/status` tool in R7).
- Property sheet webview implementation (settings via VS Code configuration + future webview; schema defined here).
- Windows-native mmkit server.
- Replacing ihsm on the extension for ConfigActor / ClientManager / PanelInteractionActor.
- Semantic LSP feature work (hover, completion, etc.).

---

## 4. Target architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ VS Code Extension (thin client)                                  │
│  ExtensionSupervisor · ConfigActor · ClientManager · Panel       │
│  LanguageServerManager → LanguageClient (TCP socket)             │
│  mmkit/* requests + mmkit/server/state notifications             │
│  OTEL SDK (optional) ──traceparent/baggage──► LSP messages       │
└────────────┬───────────────────────────────┬────────────────────┘
             │ JSON-RPC 2.0 (TCP)             │ (agents only)
             │  - standard LSP               │
             │  - mmkit/* custom             │  MCP clients
┌────────────▼───────────────────────────────▼────────────────────┐
│ mmkit Server Process (single Node.js, starts immediately)         │
│                                                                   │
│  ┌─ TCP :16011 ── LspRouter + per-request HSMs                    │
│  │     CustomHandlerRegistry (mmkit/* only)                       │
│  │                                                                │
│  ├─ HTTP :28080 ── Express                                        │
│  │     GET  /healthz /readyz /metrics  (ops)                      │
│  │     POST /mcp                       (Streamable HTTP MCP)      │
│  │                                                                │
│  ServerSupervisor                                                 │
│    └─ MmkitServerActor (cbserver install / run / stop)            │
│  McpServer (@modelcontextprotocol/server)                         │
│  Ports: process · docker · network · fs · assets                  │
│  OTEL SDK → external collector                                    │
└────────────────────────────┬────────────────────────────────────┘
                             │ OTLP (grpc or http)
┌────────────────────────────▼────────────────────────────────────┐
│ External OTEL Collector (user-provided)                          │
└─────────────────────────────────────────────────────────────────┘
```

### Responsibility split

| Concern | Owner |
| ------- | ----- |
| mmkit server process lifecycle | LSP process — `MmkitServerActor` |
| LSP language features | LSP — existing request HSMs |
| IDE server control (`mmkit/*`) | LSP — `CustomHandlerRegistry` on TCP connection |
| MCP tools / resources | LSP process — `McpServer` on `/mcp` |
| VS Code settings → snapshot | Extension — `ConfigActor` |
| Push snapshot to server | Extension — `mmkit/config/update` |
| Start/stop mmkit server UI | Extension — sends `mmkit/server/start` with snapshot |
| mmkit server state display | Extension — subscribes to `mmkit/server/state` |
| Remote TCP client (client mode) | Extension — `ClientManager` (unchanged) |
| OTEL export + trace linking | Both — shared endpoint; context on LSP + MCP HTTP headers |

---

## 5. Transport split: pure LSP + pure MCP

### LSP (TCP)

- Extension spawns `server.js` with `MMKIT_LSP_TRANSPORT=tcp`.
- `vscode-languageclient` connects via `StreamMessageReader` / `StreamMessageWriter` on a `net.Socket`.
- Custom methods use prefix `mmkit/` and are handled by `connection.onRequest` — invisible to standard LSP routing.
- **stdio** remains supported for headless tests and CLI (`MMKIT_LSP_TRANSPORT=stdio`).

### MCP (Streamable HTTP)

- `@modelcontextprotocol/server` + `@modelcontextprotocol/express` + `@modelcontextprotocol/node`.
- `createMcpExpressApp()` with DNS rebinding protection for localhost binding.
- `POST /mcp` — stateless per-request transport for simple tools; stateful sessions when SSE push is needed later.
- MCP shares `ServerSupervisor` reference for tool implementations (server status, future ConceptBase API tools).

### Ports (defaults)

| Env var | Default | Listener |
| ------- | ------- | -------- |
| `MMKIT_LSP_PORT` | `16011` | LSP TCP |
| `MMKIT_HTTP_PORT` | `28080` | Health, metrics, MCP |
| `MMKIT_LSP_TRANSPORT` | `tcp` (extension spawn) / `stdio` (tests) | — |
| `MMKIT_ASSET_ROOT` | extension `assets/cbserver` | cbserver install assets |

### Runtime

**Node.js only** — the server is spawned with `process.execPath` (bundled `server.js` in the VSIX). Bun is not a supported runtime for LSP TCP, MCP Express, or `web-tree-sitter` WASM loading in this stack.

### Process layout

One `main.ts` entrypoint:

1. `initOpenTelemetry()` (lazy flush; non-blocking).
2. `ServerSupervisor.start()`.
3. `startHttpApp(port, { readiness, metrics, supervisor })` — mounts `/mcp` + health.
4. `startLspTcp(lspPort, { readiness, metrics, supervisor })` or `startLspStdio(...)`.

---

## 6. Naming

| Context | Old | New |
| ------- | --- | --- |
| User-facing UI | cbserver | **mmkit server** |
| Status bar label | `cbserver` | **mmkit server** |
| LSP actor (code) | `ServerManager` (extension) | `MmkitServerActor` (lsp-server) |
| LSP coordinator (code) | — | `ServerSupervisor` (lsp-server) |
| Settings prefix | `mmkit.server.*` | **unchanged** |
| Docker container default | `mmkit-cbserver` | keep or alias `mmkit-server` |
| Notification method | — | `mmkit/server/state` |
| Request methods | — | `mmkit/server/start`, `stop`, `restart`, `status` |

Binary and image names (`conceptbase-cbserver`, CB env vars) remain unchanged at the OS boundary.

---

## 7. Startup: eager and fast

### Extension

1. **Activation:** `onStartupFinished` (plus existing language/notebook/editor events).
2. **Immediate:** spawn LSP server process (TCP) and connect `LanguageClient` **without waiting** for a document.
3. **No** compose up, no bundled observability stack, no HTTP sidecar process.
4. **No** mmkit server start on activation (`autoStartup` **deprecated** and ignored).

### LSP process (`main.ts`)

1. Start **ServerSupervisor** (sync, no I/O).
2. Bind HTTP app (health + MCP) and LSP TCP listener.
3. On `initialize` + `initializationOptions`, apply OTEL/asset paths — **must not block** `initialize` response.
4. **Do not** start mmkit server until `mmkit/server/start`.

### Performance budget

| Milestone | Target |
| --------- | ------ |
| LSP process alive + TCP accepting | &lt; 500 ms on dev hardware |
| `/readyz` 200 | when TCP listener up |
| ServerSupervisor + registry wired | &lt; 50 ms after module load |
| mmkit server start (warm) | unchanged from current FAST_START path |
| Cold install | progress via LSP notifications + workDoneProgress; non-blocking for LSP edits |

---

## 8. LSP custom protocol (JSON-RPC)

All custom IDE control methods use the prefix `mmkit/`. Types live in `@mmkit/shared`.
**MCP methods are not registered here.**

### 8.1 Requests (client → server)

| Method | Params | Result | Notes |
| ------ | ------ | ------ | ----- |
| `mmkit/server/start` | `MmkitServerStartParams` | `MmkitServerStartResult` | **Requires** full server config snapshot |
| `mmkit/server/stop` | `{}` | `{ ok: boolean }` | Graceful stop |
| `mmkit/server/restart` | `MmkitServerStartParams` | `MmkitServerStartResult` | stop + start |
| `mmkit/server/status` | `{}` | `MmkitServerState` | Optional; notifications are primary |
| `mmkit/config/update` | `ConfigSnapshotPayload` | `{ generation: number }` | Hot/warm/cold semantics preserved |
| `mmkit/otel/test` | `OtelEndpointConfig` | `OtelTestResult` | Probe collector reachability |

### 8.2 Notifications (server → client)

| Method | Params |
| ------ | ------ |
| `mmkit/server/state` | `MmkitServerStateNotification` |

```typescript
type MmkitServerPhase =
  | "idle"
  | "starting"
  | "installing"
  | "running"
  | "stopping"
  | "fault";

interface MmkitServerStateNotification {
  phase: MmkitServerPhase;
  port?: number;
  message?: string;
  fault?: string;
  generation?: number;
  traceContext?: { traceparent?: string; baggage?: string };
}
```

### 8.3 Standard LSP integration

- Advertise via `InitializeResult` extension field `mmkit: { serverControl: true, otel: true, mcpHttpPort: number }`.
- Custom handlers registered in `LspRouter` via `CustomHandlerRegistry`.

---

## 9. MCP server (Streamable HTTP)

### Stack

```
@modelcontextprotocol/server
@modelcontextprotocol/express
@modelcontextprotocol/node
express
```

### Endpoint

- `POST /mcp` on the same HTTP listener as `/healthz` and `/metrics`.
- Clients send `Accept: application/json, text/event-stream` for SSE push when needed.

### Initial tools (R7 skeleton)

| Tool | Description |
| ---- | ----------- |
| `mmkit_server_status` | Returns `MmkitServerState` from `ServerSupervisor` |

Future: YAML catalog mapping Java ConceptBase client API → MCP tools (separate spec).

### Shared state

`McpServer` receives `ServerSupervisor` at construction. Tool handlers read mmkit server phase, config generation, and document registry through supervisor APIs — no duplicate state.

---

## 10. Server-side state machines

### 10.1 ServerSupervisor

**Location:** `packages/lsp-server/src/supervisor/server-supervisor.ts`

| State | Meaning |
| ----- | ------- |
| `Booting` | Wiring registry, OTEL config pending |
| `Ready` | Accepting custom requests; MmkitServerActor idle |
| `ShuttingDown` | Draining MmkitServerActor + OTEL flush |

Started from `main.ts` **before** listeners bind.

### 10.2 MmkitServerActor

**Location:** `packages/lsp-server/src/mmkit-server/mmkit-server-actor.hsm.ts`

Port of extension `ServerManager` with these **semantic changes**:

| Current (`ServerManager`) | Refactored (`MmkitServerActor`) |
| ------------------------- | -------------------------------- |
| `enable()` may auto-start if `autoStartup` | **No auto-start** — only `userStart(params)` |
| Progress via `UiPort` | `window/workDoneProgress` + `mmkit/server/state` notifications |
| Fault via extension supervisor | Notification + structured log |

**Ports moved to lsp-server:** `process`, `docker`, `network`, `fs`, `assets`.

**Launch spec:** `packages/lsp-server/src/mmkit-server/launch-spec.ts`.

---

## 11. Extension client (thin shell)

### Removed

- `actors/server-manager.ts` and extension-side server ports for lifecycle
- `ExtensionSupervisor` posts to `server.manager` for start/stop
- `operationalMode: internalServer` auto-enabling ServerManager
- Compose launcher, mm devkit actor, compose status bar item
- `languageServer.launchKind` / `dockerCompose.*` settings
- `copy-observability.mjs` and generated observability assets

### Retained and adapted

| Component | Change |
| --------- | ------ |
| `ExtensionSupervisor` | Route `mmkit.startServer` → LSP `mmkit/server/start` via `LanguageServerManager` |
| `LanguageServerManager` | Spawns TCP server; registers `mmkit/server/state` handler |
| `ConfigActor` | On snapshot publish → `mmkit/config/update` |
| Status bar | **mmkit server** phase from LSP notification (no compose item) |
| Panel | `serverState` from LSP notification |
| `ClientManager` | Unchanged for `operationalMode: client` |

### Command mapping

| Command | Action |
| ------- | ------ |
| `mmkit.startServer` | `sendRequest('mmkit/server/start', params)` |
| `mmkit.stopServer` | `sendRequest('mmkit/server/stop')` |
| `mmkit.connect` / `disconnect` | ClientManager (unchanged) |

---

## 12. Unified telemetry (OTEL + W3C context)

### Configuration

| Key | Type | Default |
| --- | ---- | ------- |
| `mmkit.otel.enabled` | boolean | `false` |
| `mmkit.otel.protocol` | `grpc` \| `http` | `http` |
| `mmkit.otel.host` | string | `127.0.0.1` |
| `mmkit.otel.port` | number | `4318` |

Remove: all `mmkit.languageServer.dockerCompose.*` settings.

### Trace propagation

1. **LSP (extension → server):** `traceparent` / `baggage` on `mmkit/*` requests.
2. **MCP (agent → server):** W3C headers on HTTP `/mcp` requests.
3. **Server:** extract context per transport; attach to `MmkitServerActor` work spans.
4. **Notifications:** `mmkit/server/state` may echo `traceparent` for UI correlation.

---

## 13. Configuration and property sheet

- **No implicit start.** `mmkit.server.autoStartup` deprecated and ignored.
- Start request **must** include validated `ConfigSnapshotPayload`.
- `operationalMode`: `internalServer` → local mmkit server via LSP; `client` → remote TCP; `none` → idle.

---

## 14. Deletion list

| Path | Reason |
| ---- | ------ |
| `components/mmkit/dev/docker-compose.yml` and siblings | Observability stack removed |
| `components/mmkit/dev/Containerfile.lsp` | No LSP container |
| `packages/extension/src/lsp/compose-launcher.ts` | — |
| `packages/extension/src/actors/mm-devkit-actor.ts` | — |
| `packages/extension/scripts/copy-observability.mjs` | — |
| Extension `ServerManager` + server install tests | Moved to lsp-server |

---

## 15. Test strategy migration

| Former location | New location |
| ------------- | ------------ |
| `extension/test/server-manager*.test.ts` | `lsp-server/test/mmkit-server-actor*.test.ts` |
| Server fault injection | `lsp-server/test/ports/` |
| Extension LSP bridge | `extension/test/mmkit-lsp-bridge.test.ts` |
| MCP | `lsp-server/test/mcp-server.test.ts` |

Headless: spawn `server.js` with `MMKIT_LSP_TRANSPORT=stdio` or TCP; JSON-RPC sequences for LSP + HTTP for MCP.

---

## 16. Implementation phases

| Phase | Deliverable |
| ----- | ----------- |
| **R1** | `@mmkit/shared` protocol types; `ServerSupervisor`; `CustomHandlerRegistry` |
| **R2** | `MmkitServerActor` + ports + `mmkit/server/*` on LSP TCP |
| **R3** | Extension TCP bridge; remove extension `ServerManager`; notification → UI |
| **R4** | Delete observability stack; update settings/docs |
| **R5** | OTEL settings + traceparent/baggage |
| **R6** | Test migration; CI headless integration |
| **R7** | MCP Express `/mcp` + initial tools |

---

## 17. Acceptance criteria

1. Extension activates on `onStartupFinished`; LSP TCP accepting **before** opening any `.cbs` file.
2. mmkit server **does not** start until user runs Start.
3. `POST /mcp` responds to MCP `initialize` (Streamable HTTP).
4. No Docker Compose observability stack in repo.
5. Status bar shows **mmkit server** from `mmkit/server/state`.
6. Former `ServerManager` unit tests pass against `MmkitServerActor` in lsp-server.
7. Extension test suite does not import `server-manager.ts`.

---

## 18. Risks and mitigations

| Risk | Mitigation |
| ---- | ---------- |
| LSP process crash kills mmkit server | MmkitServerActor isolate install I/O; child exit → `fault` notification |
| MCP and LSP port conflicts | Configurable env vars; port-free check in extension spawn |
| vscode-languageclient trace propagation limited | Custom `traceContext` on `mmkit/*` params |
| Large move breaks CI | Phase R6 dedicated; incremental PRs |

---

## Document history

| Date | Version | Change |
| ---- | ------- | ------ |
| 2026-06-07 | 1.0.0-draft | Initial server-centric refactor spec |
| 2026-06-07 | 1.1.0-draft | Pure LSP TCP + pure MCP Streamable HTTP; reject shared-channel MCP |
