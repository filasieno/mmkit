# lsp-server source layout

Four top-level sections under `src/`:

```
src/
  main.ts          # bootstrap: shared HTTP + lsp transport + mcp + cbserver supervisor
  shared/          # cross-cutting: HTTP, OTEL, cbserver ports (process/docker/fs/…)
  lsp/             # Language Server Protocol: documents, tree-sitter, requests, router
  mcp/             # Model Context Protocol: tools, CbTcpClient, validation
  cbserver/        # mmkit server (cbserver) lifecycle: actor HSM + supervisor
```

| Section | Entry points |
| ------- | ------------ |
| **shared** | `http-app.ts`, `telemetry/`, `ports/` |
| **lsp** | `lsp-app.ts`, `router/lsp-router.ts`, `parse.ts`, `tree-sitter/` |
| **mcp** | `mcp-server.ts`, `register-cb-tools.ts`, `validation/`, `docs/MCP-AI.md` |
| **cbserver** | `mmkit-server/mmkit-server-actor.hsm.ts`, `supervisor/server-supervisor.ts` |

AI agents: read [`mcp/docs/MCP-AI.md`](../mcp/docs/MCP-AI.md).
