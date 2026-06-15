import { TextDocuments } from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { DocumentRegistry } from "../../src/lsp/document-registry";
import { DiagnosticsPublisher } from "../../src/lsp/diagnostics/publisher";
import { NotebookRegistry } from "../../src/lsp/notebook-registry";
import type { LspServerContext } from "../../src/lsp/lsp-server-context";
import { createLspSensors } from "../../src/lsp/ports/lsp-sensors";
import { SimLspActuators } from "../../src/lsp/ports/sim/sim-lsp-actuators";
import { LspActorRegistry } from "../../src/lsp/registry/lsp-actor-registry";
import { createLspMetrics } from "../../src/shared/telemetry/metrics";

export function mockLspServer(actuators = new SimLspActuators()): LspServerContext {
  const registry = new LspActorRegistry();
  const metrics = createLspMetrics();
  return {
    connection: {} as LspServerContext["connection"],
    actuators,
    sensors: createLspSensors(),
    registry,
    readiness: { started: true, lspInitialized: false },
    metrics,
    documents: new TextDocuments(TextDocument),
    documentRegistry: new DocumentRegistry(),
    notebookRegistry: new NotebookRegistry(),
    diagnosticsPublisher: new DiagnosticsPublisher(() => undefined),
  };
}
