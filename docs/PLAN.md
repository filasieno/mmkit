# mmkit — Implementation Plan

**Version:** 0.1.0 → 0.2.0 target  
**Date:** 2026-06-07  
**Baseline:** [STATUS.md](./STATUS.md) · [DESIGN.md](./DESIGN.md)

Ordered next steps to move from **development preview** to **production-ready** release.

---

## Priority legend

| Priority | Meaning |
| -------- | ------- |
| **P0** | Blocker for any external user |
| **P1** | Required for production candidate |
| **P2** | Hardening / parity with design spec |
| **P3** | Nice-to-have / v0.3+ |

---

## Completed since last plan (reference)

| Item | Status |
| ---- | ------ |
| P9–P12 Language tooling scaffold | **Done** — workspaces, LSP, notebook, `.cbs` |
| P13 Dev observability stack | **Done** — Victoria + Grafana + OTEL + docker compose launch |
| P14 LSP integration tests | **Done** — `test-integration/suite/lsp-client.test.ts` |
| P15 LSP request/notification HSM layer (§20) | **Done** — `router/`, `requests/`, actuators, cancellation |
| LSP OpenTelemetry + Prometheus | **Done** — `telemetry/*`, `/metrics` scrape |
| `getLanguageClientState()` test API | **Done** |

---

## Phase 1 — Release candidate (P0–P1)

### 1.1 Manual smoke runbook (P0)

- [ ] Document step-by-step smoke in `docs/SMOKE-TEST.md` (F5, panel, LSP `.cbs`, Grafana URL, trace level)
- [ ] Verify on clean WSL2: compose stack, `~/.mmkit` materialize, port conflict messaging
- [ ] Capture expected MMKit Trace + ConceptBase LSP output channel lines

### 1.2 Integration / E2E CI (P0)

- [x] LSP integration suite (`lsp-client.test.ts`) — 8 tests
- [ ] Add GitLab job: `npm test` + `npm run build` (unit always)
- [ ] Add GitLab job: `npm run test:integration` on runner with VS Code test binary cached
- [ ] Optional job `MMKIT_DOCKER_E2E=1` / `MMKIT_LSP_DOCKER_E2E=1` on Docker runners
- [x] Export `getMmkitTestApi()` + `getLanguageClientState()` for integration tests

### 1.3 CONFIGURATION.md sync (P1)

- [ ] Document `mmkit.languageServer.launchKind` and `dockerCompose.*` ports
- [ ] Document observability stack URLs and anonymous Grafana access
- [ ] Add `mmkit.traceLevel` section if missing
- [ ] Property-sheet references → MMKit panel where implemented

### 1.4 Panel UX polish (P1)

- [ ] Status bar click → open MMKit panel (or toggle)
- [ ] Show last fault in panel `statusMessage` when `managerReportFault` fires

### 1.5 Webview bundle size (P1)

- [ ] Evaluate Preact vs React — target &lt; 200 KB for `out/panel-webview/main.js`

---

## Phase 2 — cbserver design parity (P2)

### 2.1 ServerManager resilience

- [ ] `Faulted` composite state + `userAcknowledgeFault`
- [ ] `RestartPending` + `restartDelaySeconds`
- [ ] Crash-loop cap (`maxErrors` / consecutive exit counter)
- [ ] `processExited` in `Running` → restart or fault per policy

### 2.2 ConfigActor warm/cold diff

- [ ] Emit `diffRequiresRestart(keys)` when warm/cold fields change
- [ ] Coordinator orchestrates controlled server restart

### 2.3 ClientManager hardening

- [ ] `autoReconnect` backoff with max attempts cap
- [ ] `CANCEL_ME` on disconnect path

---

## Phase 3 — LSP request / notification HSM layer (P1–P2) — §20 — **Done**

**Goal:** one ihsm per LSP request and notification; cancellable request replies;
mandatory work-done progress; headless testing via `LspActuators`.

### 3.1 Infrastructure scaffold (P1) — **Done**

- [x] `packages/lsp-server/src/registry/lsp-actor-registry.ts`
- [x] `packages/lsp-server/src/ports/lsp-actuators.ts` + `lsp-sensors.ts`
- [x] `packages/lsp-server/src/ports/real/connection-actuators.ts`
- [x] `packages/lsp-server/src/ports/sim/sim-lsp-actuators.ts`
- [x] `packages/lsp-server/src/cancellation/cancellable-request-deferred.ts`
- [x] `packages/lsp-server/src/progress/work-done-tracker.ts`
- [x] `packages/lsp-server/src/router/lsp-router.ts` (thin `connection.on*` only)

### 3.2 Mandatory capabilities (P1) — **Done**

- [x] `WorkDoneProgress.type` on connection actuators (server-initiated progress)
- [x] `WorkDoneTracker` on every request executor
- [x] Unit tests: sim actuators receive `begin` → `report*` → `end` sequence

### 3.3 Per-message HSM migration (P1–P2) — **Done**

| Folder | LSP method | Status |
| ------ | ---------- | ------ |
| `requests/initialize/` | `initialize` | ✓ |
| `requests/initialized/` | `initialized` | ✓ |
| `requests/text-document-did-open/` | `textDocument/didOpen` | ✓ |
| `requests/text-document-did-change/` | `textDocument/didChange` | ✓ |
| `requests/text-document-did-close/` | `textDocument/didClose` | ✓ |
| `requests/semantic-tokens-full/` | `textDocument/semanticTokens/full` | ✓ |
| `requests/semantic-tokens-range/` | `textDocument/semanticTokens/range` | ✓ |
| `requests/notebook-did-*/` | notebook sync | ✓ |

**Rule:** new handlers go in `requests/<name>/` only; `lsp-router.ts` wires `connection.on*`.

### 3.4 Cancellation (P1) — **Done**

- [x] `CancellationToken` on semantic-token handlers → `registry.cancel(id)`
- [x] `CancellableRequestDeferred` posts `asyncStarted` → `AwaitingAsync`
- [x] `registry.isCancelled(id)` checked before `completeRequest`
- [x] Tests: cancel in-flight request; registry entry removed

### 3.5 Headless HSM tests (P2) — **Done**

- [x] Request executor + registry unit tests with `SimLspActuators`
- [x] Fault injection on actuators (`SimLspActuators.throwOn`)
- [x] Registry leak test after terminal states
- [x] Semantic tokens full/range HSM tests + `CancellableRequestDeferred` tests
- [x] `$/cancelRequest` → sensors → `registry.cancel` in `LspRouter`

### 3.6 Monolith removal (P2) — **Done**

- [x] `lsp-app.ts` reduced to transport re-exports; logic in `router/` + `requests/`
- [x] DESIGN §20 implemented; use imperative `ihsm.InitialState()` (esbuild-safe)

---

## Phase 4 — Property sheet & settings UX (P2–P3)

### 4.1 Property sheet webview (P2)

- [ ] Inline edit hot/warm fields via `FIELD_REGISTRY`
- [ ] `ConfigActor.settingsPatch` integration

---

## Phase 5 — Quality gates (P1–P2)

### 5.1 Coverage

- [ ] LSP `requests/**` branch coverage ≥ 90% as HSMs land
- [ ] Extension `src/actors/**` branch coverage toward 100%
- [ ] Nix `checkPhase` fail below interim threshold

### 5.2 Performance

- [ ] Semantic tokens on large files: progress + cancel (validates §20)

---

## Phase 6 — Packaging & distribution (P1)

### 6.1 Release pipeline

- [ ] Semver bump: `package.json`, `nix/mmkit.nix`
- [ ] `vsce package` CI artifact; GitLab release
- [ ] Open VSX / marketplace listing

---

## Phase 7 — Out of scope reminders (v0.3+)

- O-Telos LSP integration
- MCP server for metamodelling
- Windows native cbserver
- cbserver-backed LSP completion

---

## Suggested timeline (indicative)

| Sprint | Focus                                            | Exit                                                            |
|------- |--------------------------------------------------|-----------------------------------------------------------------|
| S1    | 1.1–1.3, 3.1–3.2                                  | Smoke doc; CI; LSP registry + actuators + progress capability   |
| S2    | 3.3–3.4 (initialize + didChange + semanticTokens) | Cancellation tests green                                        |
| S3    | 3.3 notebook + 3.6 delete `lsp-app.ts`            | §20 complete                                                    |
| S4    | 2.1 server fault/restart, 6.1                     | RC VSIX                                                         |

---

## Definition of done (v0.2.0 production candidate)

1. All **P0** and **P1** items checked off (including §20 scaffold + core request HSMs).
2. `npm test` + `npm run test:integration` + Nix `checkPhase` green.
3. [STATUS.md](./STATUS.md) production checklist ≥ 8/10 **Ready**.
4. [DESIGN.md](./DESIGN.md) §20 implemented for all current LSP entry points.
5. `workDoneProgress` advertised and tested.

---

*Maintainers: update this plan when closing STATUS risks or completing phases.*
