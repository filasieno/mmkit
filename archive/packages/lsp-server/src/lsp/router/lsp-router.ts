import {
  createConnection,
  ProposedFeatures,
  type Connection,
  type InitializeParams,
  type InitializeResult,
  StreamMessageReader,
  StreamMessageWriter,
} from "vscode-languageserver/node";
import { createServer, type Server as NetServer } from "node:net";
import type { TextDocument } from "vscode-languageserver-textdocument";
import { createLspServerContext, type LspServerContext } from "../lsp-server-context";
import { runInitializeRequest } from "../requests/initialization/initialize-request.hsm";
import { spawnInitializedNotification } from "../requests/initialization/initialized-notification.hsm";
import { spawnNotebookDidChange } from "../requests/notebook/did-change-notification.hsm";
import { spawnNotebookDidClose } from "../requests/notebook/did-close-notification.hsm";
import { spawnNotebookDidOpen } from "../requests/notebook/did-open-notification.hsm";
import { spawnNotebookDidSave } from "../requests/notebook/did-save-notification.hsm";
import { runSemanticTokensFullRequest } from "../requests/semantic-tokens/full-request.hsm";
import { runSemanticTokensRangeRequest } from "../requests/semantic-tokens/range-request.hsm";
import { spawnDidChangeNotification } from "../requests/text-document/did-change-notification.hsm";
import { spawnDidCloseNotification } from "../requests/text-document/did-close-notification.hsm";
import { spawnDidOpenNotification } from "../requests/text-document/did-open-notification.hsm";
import { spawnDidSaveNotification } from "../requests/text-document/did-save-notification.hsm";
import { spawnWillSaveNotification } from "../requests/text-document/will-save-notification.hsm";
import { runWillSaveWaitUntilRequest } from "../requests/text-document/will-save-wait-until-request.hsm";
import { MMKIT_LSP_METHODS } from "@mmkit/shared";
import type { CustomHandlerRegistry } from "../../cbserver/supervisor/custom-handler-registry";
import type { ServerSupervisor } from "../../cbserver/supervisor/server-supervisor";
import type { ReadinessState } from "../../shared/telemetry/http";
import type { LspMetrics } from "../../shared/telemetry/metrics";
import { otelLogger } from "../../shared/telemetry/otel";

export interface LspBindOptions {
  readiness: ReadinessState;
  metrics: LspMetrics;
  supervisor: ServerSupervisor;
  customHandlers: CustomHandlerRegistry;
}

export class LspRouter {
  constructor(
    private readonly server: LspServerContext,
    private readonly bindOptions: LspBindOptions
  ) {}

  bind(connection: Connection): void {
    this.server.sensors.onCancel((requestId) => {
      this.server.registry.cancel(requestId);
    });

    connection.onNotification("$/cancelRequest", (params: { id: string | number }) => {
      this.server.sensors.emitCancel(params.id);
    });

    connection.onInitialize((params: InitializeParams): Promise<InitializeResult> => {
      return runInitializeRequest(this.server, params, this.bindOptions);
    });

    this.bindCustomHandlers(connection);

    connection.onInitialized(() => {
      spawnInitializedNotification(this.server);
      this.bindNotebookHandlers();
    });

    connection.languages.semanticTokens.on((params, token) =>
      runSemanticTokensFullRequest(this.server, params, token)
    );

    connection.languages.semanticTokens.onRange((params, token) =>
      runSemanticTokensRangeRequest(this.server, params, token)
    );

    this.server.documents.onDidOpen((event) => {
      spawnDidOpenNotification(this.server, event.document);
    });

    this.server.documents.onDidChangeContent((change) => {
      spawnDidChangeNotification(this.server, change.document);
    });

    this.server.documents.onWillSave((event) => {
      spawnWillSaveNotification(this.server, event);
    });

    this.server.documents.onWillSaveWaitUntil((event) => runWillSaveWaitUntilRequest(this.server, event));

    this.server.documents.onDidSave((event) => {
      spawnDidSaveNotification(this.server, event);
    });

    this.server.documents.onDidClose((event) => {
      spawnDidCloseNotification(this.server, event.document);
    });

    this.server.documents.listen(connection);
    connection.listen();
  }

  private bindCustomHandlers(connection: Connection): void {
    const { customHandlers } = this.bindOptions;
    const methods = [
      MMKIT_LSP_METHODS.serverStart,
      MMKIT_LSP_METHODS.serverStop,
      MMKIT_LSP_METHODS.serverRestart,
      MMKIT_LSP_METHODS.serverStatus,
      MMKIT_LSP_METHODS.configUpdate,
      MMKIT_LSP_METHODS.otelTest,
    ] as const;

    for (const method of methods) {
      if (!customHandlers.has(method)) continue;
      connection.onRequest(method, async (params: unknown) => {
        return customHandlers.dispatch(method, params ?? {});
      });
    }
  }

  private bindNotebookHandlers(): void {
    const sync = this.server.connection.notebooks?.synchronization;
    if (!sync) return;

    sync.onDidOpenNotebookDocument((event) => spawnNotebookDidOpen(this.server, event));
    sync.onDidChangeNotebookDocument((event) => spawnNotebookDidChange(this.server, event));
    sync.onDidCloseNotebookDocument((event) => spawnNotebookDidClose(this.server, event));
    sync.onDidSaveNotebookDocument((event) => spawnNotebookDidSave(this.server, event));
  }
}

export type ConnectionWireHook = (
  connection: Connection,
  actuators: import("../ports/lsp-actuators").LspActuators
) => void;

export function bindLspServer(
  connection: Connection,
  options: LspBindOptions,
  onWire?: ConnectionWireHook
): LspServerContext {
  const server = createLspServerContext(connection, options.readiness, options.metrics, options.supervisor);
  options.readiness.started = true;
  onWire?.(connection, server.actuators);
  const router = new LspRouter(server, options);
  router.bind(connection);
  return server;
}

export function startLspStdio(options: LspBindOptions, onWire?: ConnectionWireHook): LspServerContext {
  const connection = createConnection(ProposedFeatures.all);
  return bindLspServer(connection, options, onWire);
}

export function startLspTcp(port: number, options: LspBindOptions, onWire?: ConnectionWireHook): NetServer {
  const log = otelLogger("mmkit-lsp");
  let clientConnection: Connection | undefined;

  const netServer = createServer((socket) => {
    if (clientConnection) {
      log.emit({
        severityText: "WARN",
        body: "rejecting additional LSP TCP client — only one client supported",
      });
      socket.destroy();
      return;
    }

    const connection = createConnection(
      ProposedFeatures.all,
      new StreamMessageReader(socket),
      new StreamMessageWriter(socket)
    );
    clientConnection = connection;
    socket.on("close", () => {
      clientConnection = undefined;
    });
    bindLspServer(connection, options, onWire);
    log.emit({
      severityText: "INFO",
      body: "LSP TCP client connected",
      attributes: { port },
    });
  });

  netServer.listen(port, "0.0.0.0", () => {
    options.readiness.started = true;
    log.emit({
      severityText: "INFO",
      body: "LSP TCP server listening",
      attributes: { port },
    });
  });

  return netServer;
}

export type { TextDocument };
