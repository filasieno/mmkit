# mmkit — Metamodelling Kit

VS Code extension for **ConceptBase** metamodelling. This workspace was reset to a minimal
bootstrap; the previous implementation lives under `archive/packages/`.

Standalone repository — depends on [conceptbase-cc](https://github.com/filasieno/conceptbase-cc) for the `cbserver` binary in Nix dev shells and real integration tests.

## Workspace layout

```
mmkit/
  archive/packages/       previous extension, lsp-server, shared
  package.json              npm workspaces root
  packages/
    base/                   @mmkit/base — documented config interfaces (IMmkit*), protocol
    server/                 @mmkit/server — MCP, HTTP, LSP, cbserver (ihsm actor), system entry
    extension/              mmkit — VS Code extension, property sheet & contributes generation
```

## Build

```bash
npm install
npm run build
```

F5 from `packages/extension/` (Run Extension).

## Test

```bash
npm test
npm run test:integration
```

Real cbserver tests (requires Nix dev shell with conceptbase-cc input):

```bash
nix develop
npm run test:cbserver:real -w @mmkit/server
```

## Package (Nix)

```bash
nix build .#mmkit -L
```
