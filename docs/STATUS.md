# mmkit — Status Report

**Version:** 0.1.0  
**Date:** 2026-06-07  
**Extension:** Metamodelling Kit (`conceptbase.mmkit`)

This document describes the **current implementation state** and **production readiness**.
For architecture see [DESIGN.md](./DESIGN.md). For next work see [PLAN.md](./PLAN.md).

---

## Executive summary

mmkit is a **functional development preview**: cbserver lifecycle actors, ConceptBase
LSP (incremental sync, tree-sitter diagnostics, semantic tokens), MM notebooks, dev
observability stack (VictoriaMetrics / VictoriaLogs / VictoriaTraces / Grafana / OTEL),
and structured tracing are implemented with broad automated test coverage. It is **not
yet production-ready** for unattended end-user deployment — property editor and
server crash-loop policy are open, and marketplace release is not set up. LSP request
handling uses per-message ihsm actors (§20, done).

| Dimension | Rating | Notes |
| --------- | ------ | ----- |
| Architecture fidelity (cbserver) | **High** | ihsm actors, ports, coordinator match DESIGN §6–14 |
| Architecture fidelity (LSP) | **High** | Per-request/notification HSMs, actuators, cancellation (§20) |
| Unit test coverage | **Good** | 241 unit tests (166 LSP + 75 extension) |
| Integration tests | **Good (LSP)** | 8 VS Code electron tests; docker E2E opt-in |
| Real-stack validation | **Partial** | LSP integration + optional `MMKIT_DOCKER_E2E` |
| Operator UX | **Adequate (dev)** | Panel + palette + status bar |
| Observability | **Good (dev)** | MMKit Trace + Victoria stack + LSP OTLP/Prometheus |
| Production ops | **Low** | No crash-loop policy, no marketplace pipeline |

**Recommendation:** suitable for **developer smoke testing** on Linux/WSL with Docker;
not for production GitOps or non-technical end users without completing [PLAN.md](./PLAN.md).

---

## Implemented components

### Actors (ihsm state machines) — extension host

| Actor ID | States (implemented) | Notes |
| -------- | -------------------- | ----- |
| `plugin.coordinator` | `Inactive`, `Bootstrapping`, `Active`, `SwitchingMode`, `ShuttingDown` | Mode switch, shutdown watchdog, panel routing |
| `config` | `Inactive`, `Loading`, `Ready`, `ShuttingDown` | Snapshot publish |
| `server.manager` | `Disabled`, `Idle`, `Starting`, `Installing*`, `Running`, `Stopping`, `ShuttingDown` | Docker / executable launch |
| `client.manager` | `Disabled`, `Idle`, `Connecting`, `Connected`, `Disconnecting`, `ShuttingDown` | ENROLL_ME |
| `panel.interaction` | `Disabled`, `Active`, `ShuttingDown` | React ViewModel |

**Separate process:** `LspActorRegistry` + per-request HSMs in `@mmkit/lsp-server` (§20).

### ConceptBase LSP (`@mmkit/lsp-server`)

| Feature | Status |
| ------- | ------ |
| Incremental `textDocument/sync` | ✓ |
| Notebook `notebookDocument/sync` | ✓ |
| tree-sitter diagnostics | ✓ (WASM) |
| Semantic tokens (full + range) | ✓ |
| OpenTelemetry (logs, traces, metrics) | ✓ OTLP to collector |
| Prometheus `/metrics`, `/healthz`, `/readyz` | ✓ HTTP sidecar |
| TCP transport (docker compose) | ✓ |
| stdio transport (direct / tests) | ✓ |
| Per-request ihsm + cancellation | ✓ `LspRouter` + `requests/**` HSMs |
| `workDoneProgress` notifications | ✓ mandatory `WorkDoneTracker` on every request |

**Transport:** `router/lsp-router.ts` binds `connection.on*`; `lsp-app.ts` is a thin re-export.

### LSP client (`packages/extension/src/lsp/`)

| Feature | Status |
| ------- | ------ |
| `LanguageClient` spawn | ✓ |
| `launchKind: dockerCompose` (default) | ✓ Victoria stack via compose |
| `launchKind: direct` (stdio) | ✓ integration tests |
| Grafana URL logged on stack start | ✓ |
| `mmkit.restartLanguageServer` | ✓ |

### Ports (extension)

| Port | Real | Sim + fault tests |
| ---- | ---- | ----------------- |
| `VscodeConfigPort` | ✓ | ✓ |
| `FsPort` | ✓ | ✓ |
| `AssetPort` | ✓ | ✓ |
| `ProcessPort` | ✓ | ✓ |
| `DockerPort` | ✓ | ✓ |
| `NetworkPort` | ✓ | ✓ |
| `TcpPort` | ✓ | ✓ |
| `UiPort` | ✓ | ✓ |
| `PanelPort` | ✓ | ✓ |

### VS Code integration

| Feature | Status |
| ------- | ------ |
| `contributes.configuration` | ✓ |
| `mmkit.traceLevel`, `mmkit.languageServer.*` | ✓ |
| Activity bar **MMKit** webview | ✓ |
| `.cbs` + `.mmnb` + `conceptbase` grammar | ✓ |
| Nix `mmkit` derivation → `.vsix` | ✓ |

### Dev observability stack

| Component | Port (default) |
| --------- | -------------- |
| VictoriaMetrics | 8428 |
| VictoriaLogs | 9428 |
| VictoriaTraces | 10428 |
| Grafana (anonymous) | 3000 |
| OTEL Collector | 4317 / 4318 |
| mmkit-lsp (TCP / HTTP) | 6011 / 8080 |

Config: `components/mmkit/dev/docker-compose.yml` (bundled to `packages/extension/observability/`).

### Testing

| Command | Result (last known) |
| ------- | ------------------- |
| `npm test` | **241 passing** — 166 `@mmkit/lsp-server` + 75 `mmkit` |
| `npm run test:integration` | **8 passing**, 3 pending (docker E2E opt-in) |
| `lsp-client.test.ts` | LSP Running, open `.cbs`, diagnostics, edit, restart |
| Fault injection suites | server, client, config, panel, coordinator |

---

## Gaps vs design specification

| Design area | Gap |
| ----------- | --- |
| **LSP per-request HSMs (§20)** | Done — `requests/` layout + shared executors |
| **Cancellable request replies** | Via `CancellationToken` + `registry.cancel` + `CancellableRequestDeferred` |
| **workDoneProgress / progress** | `WorkDoneTracker` on all requests; `WorkDoneProgress.type` on actuators |
| **LspActuators / Sim headless LSP tests** | `SimLspActuators` + registry + executor unit tests |
| Property sheet webview | Settings UI only |
| `ServerManager` `Faulted` / crash-loop | Not implemented |
| `configRequiresRestart` warm diff | Not wired |
| `pollTick` health in `Running` | Not implemented |
| 100% branch coverage gate | Not enforced in CI |
| O-Telos LSP / MCP | Out of scope |
| Windows native cbserver | Out of scope |

---

## Production readiness checklist

| Criterion | Ready? | Evidence / blocker |
| --------- | ------ | ------------------ |
| ConceptBase editing (syntax + tokens) | **Yes** | Unit + integration LSP tests |
| LSP cancellation / progress | **Yes** | §20 HSM layer + integration tests |
| Deterministic install under fault | **Partial** | Fault tests; no chaos on real Docker |
| Graceful extension shutdown | **Yes** | LSP stop + compose down |
| Dev observability stack | **Yes** | docker compose; port conflicts possible |
| End-user documentation | **Partial** | CONFIGURATION.md |
| Signed VSIX / marketplace | **No** | Nix build only |
| CI integration tests | **Partial** | Local `npm run test:integration`; not default GitLab job |

---

## How to verify today

```bash
cd components/mmkit
npm run build
npm test
npm run test:integration

# F5 → Run Extension (starts observability stack by default)
# Grafana: http://127.0.0.1:3000 (anonymous)

# Optional:
MMKIT_DOCKER_E2E=1 npm run test:integration -w mmkit
MMKIT_LSP_DOCKER_E2E=1 MMKIT_HTTP_PORT=18080 MMKIT_LSP_PORT=16011 npm run test:integration -w mmkit
```

**Prerequisites:** Docker (default `launchKind: dockerCompose` for LSP and cbserver),
image `conceptbase-cbserver:0.1.1`, ports 3000/4001/6011/8080 free or overridden in settings.

---

## Risk register

| Risk | Severity | Mitigation |
| ---- | -------- | ---------- |
| LSP handler regressions during extension | Medium | Per-message HSM tests + integration suite |
| Port conflicts on dev host | Medium | Settings + env overrides; test mode disables LSP HTTP |
| Design doc drift | Medium | This STATUS + PLAN cadence |
| Missing server crash-loop policy | High for prod | PLAN Phase 2 |
| Large webview bundle (~1 MB) | Low | Preact / vanilla (PLAN) |

---

*Next review: after PLAN Phase 2 (ServerManager resilience) or Phase 1 CI jobs.*
