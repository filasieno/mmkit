import { TextDocuments } from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import type { Connection } from "vscode-languageserver/node";
import { DocumentRegistry } from "./document-registry";
import { DiagnosticsPublisher } from "./diagnostics/publisher";
import { NotebookRegistry } from "./notebook-registry";
import type { LspActuators } from "./ports/lsp-actuators";
import { createConnectionActuators } from "./ports/real/connection-actuators";
import type { LspSensors } from "./ports/lsp-sensors";
import { createLspSensors } from "./ports/lsp-sensors";
import { LspActorRegistry } from "./registry/lsp-actor-registry";
import type { ServerSupervisor } from "../cbserver/supervisor/server-supervisor";
import type { ReadinessState } from "../shared/telemetry/http";
import type { LspMetrics } from "../shared/telemetry/metrics";

export interface LspServerContext {
  connection: Connection;
  actuators: LspActuators;
  sensors: LspSensors;
  registry: LspActorRegistry;
  readiness: ReadinessState;
  metrics: LspMetrics;
  supervisor?: ServerSupervisor;
  documents: TextDocuments<TextDocument>;
  documentRegistry: DocumentRegistry;
  notebookRegistry: NotebookRegistry;
  diagnosticsPublisher: DiagnosticsPublisher;
}

export function createLspServerContext(
  connection: Connection,
  readiness: ReadinessState,
  metrics: LspMetrics,
  supervisor?: ServerSupervisor,
  actuators?: LspActuators,
  sensors?: LspSensors
): LspServerContext {
  const registry = new LspActorRegistry();
  const documentRegistry = new DocumentRegistry();
  const notebookRegistry = new NotebookRegistry();
  const documents = new TextDocuments(TextDocument);
  const realActuators = actuators ?? createConnectionActuators(connection);
  const realSensors = sensors ?? createLspSensors();
  const diagnosticsPublisher = new DiagnosticsPublisher((params) =>
    realActuators.publishDiagnostics(params.uri, params.diagnostics)
  );

  return {
    connection,
    actuators: realActuators,
    sensors: realSensors,
    registry,
    readiness,
    metrics,
    supervisor,
    documents,
    documentRegistry,
    notebookRegistry,
    diagnosticsPublisher,
  };
}
