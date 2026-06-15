import {
  RegistrationRequest,
  UnregistrationRequest,
  WorkDoneProgress,
} from "vscode-languageserver-protocol";
import type { Connection } from "vscode-languageserver/node";
import type {
  ApplyWorkspaceEditParams,
  ConfigurationItem,
  Diagnostic,
  MessageActionItem,
  MessageType,
  ProgressToken,
  Registration,
  ShowDocumentParams,
  ShowDocumentResult,
  Unregistration,
  WorkspaceEdit,
  WorkspaceFolder,
} from "vscode-languageserver/node";
import type { LspActuators } from "../lsp-actuators";

export function createConnectionActuators(connection: Connection): LspActuators {
  return {
    publishDiagnostics(uri: string, diagnostics: Diagnostic[]) {
      void connection.sendDiagnostics({ uri, diagnostics });
    },

    sendProgress(token: ProgressToken, value) {
      void connection.sendProgress(WorkDoneProgress.type, token, value);
    },
    beginWorkDone(token: ProgressToken, title: string, cancellable = false) {
      void connection.sendProgress(WorkDoneProgress.type, token, {
        kind: "begin",
        title,
        cancellable,
      });
    },
    reportWorkDone(token: ProgressToken, message?: string, percentage?: number) {
      void connection.sendProgress(WorkDoneProgress.type, token, {
        kind: "report",
        message,
        percentage,
      });
    },
    endWorkDone(token: ProgressToken) {
      void connection.sendProgress(WorkDoneProgress.type, token, { kind: "end" });
    },

    logMessage(type: MessageType, message: string) {
      void connection.sendNotification("window/logMessage", { type, message });
    },
    showErrorMessage(message: string, ...actions: MessageActionItem[]) {
      if (actions.length === 0) {
        void connection.window.showErrorMessage(message);
        return Promise.resolve(undefined);
      }
      return connection.window.showErrorMessage(message, ...actions);
    },
    showWarningMessage(message: string, ...actions: MessageActionItem[]) {
      if (actions.length === 0) {
        void connection.window.showWarningMessage(message);
        return Promise.resolve(undefined);
      }
      return connection.window.showWarningMessage(message, ...actions);
    },
    showInformationMessage(message: string, ...actions: MessageActionItem[]) {
      if (actions.length === 0) {
        void connection.window.showInformationMessage(message);
        return Promise.resolve(undefined);
      }
      return connection.window.showInformationMessage(message, ...actions);
    },
    showDocument(params: ShowDocumentParams): Promise<ShowDocumentResult> {
      return connection.window.showDocument(params);
    },

    consoleLog(message: string) {
      connection.console.log(message);
    },
    consoleInfo(message: string) {
      connection.console.info(message);
    },
    consoleWarn(message: string) {
      connection.console.warn(message);
    },
    consoleError(message: string) {
      connection.console.error(message);
    },
    consoleDebug(message: string) {
      connection.console.debug(message);
    },

    applyWorkspaceEdit(edit: ApplyWorkspaceEditParams | WorkspaceEdit) {
      return connection.workspace.applyEdit(edit);
    },
    getConfiguration(items: ConfigurationItem[]) {
      return connection.workspace.getConfiguration(items);
    },
    getWorkspaceFolders(): Promise<WorkspaceFolder[] | null | undefined> {
      return connection.workspace.getWorkspaceFolders();
    },

    registerCapabilities(registrations: Registration[]) {
      return connection.sendRequest(RegistrationRequest.type, { registrations });
    },
    unregisterCapabilities(unregisterations: Unregistration[]) {
      return connection.sendRequest(UnregistrationRequest.type, { unregisterations });
    },

    refreshSemanticTokens() {
      connection.languages.semanticTokens.refresh();
    },

    logTelemetryEvent(data: Record<string, unknown>) {
      connection.telemetry.logEvent(data);
    },
    logTrace(message: string, verbose?: string) {
      connection.tracer.log(message, verbose);
    },
  };
}
