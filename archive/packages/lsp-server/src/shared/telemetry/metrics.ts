import { Counter, Gauge, Registry, collectDefaultMetrics } from "prom-client";

export interface LspMetrics {
  documentsOpen: Gauge;
  diagnosticsPublished: Counter;
  lspInitialized: Counter;
  registry: Registry;
}

export function createLspMetrics(): LspMetrics {
  const registry = new Registry();
  collectDefaultMetrics({ register: registry, prefix: "mmkit_lsp_" });

  const documentsOpen = new Gauge({
    name: "mmkit_lsp_documents_open",
    help: "Number of open ConceptBase documents tracked by the language server",
    registers: [registry],
  });

  const diagnosticsPublished = new Counter({
    name: "mmkit_lsp_diagnostics_published_total",
    help: "Total diagnostic publish operations",
    registers: [registry],
  });

  const lspInitialized = new Counter({
    name: "mmkit_lsp_initialize_total",
    help: "LSP initialize handshakes completed",
    registers: [registry],
  });

  return { documentsOpen, diagnosticsPublished, lspInitialized, registry };
}
