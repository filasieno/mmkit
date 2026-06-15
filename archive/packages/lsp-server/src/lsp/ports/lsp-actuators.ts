import type {
  ApplyWorkspaceEditParams,
  ApplyWorkspaceEditResponse,
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

export interface WorkDoneProgressBegin {
  kind: "begin";
  title: string;
  cancellable?: boolean;
}

export interface WorkDoneProgressReport {
  kind: "report";
  message?: string;
  percentage?: number;
}

export interface WorkDoneProgressEnd {
  kind: "end";
}

export type ProgressNotificationValue =
  | WorkDoneProgressBegin
  | WorkDoneProgressReport
  | WorkDoneProgressEnd;

/**
 * All server→client LSP channels. Production wraps `Connection`; tests use `SimLspActuators`.
 *
 * @see components/mmkit/docs/DESIGN.md §20.5
 */
export interface LspActuators {
  // --- Diagnostics ---
  publishDiagnostics(uri: string, diagnostics: Diagnostic[]): void;

  // --- Window: progress ---
  sendProgress(token: ProgressToken, value: ProgressNotificationValue): void;
  beginWorkDone(token: ProgressToken, title: string, cancellable?: boolean): void;
  reportWorkDone(token: ProgressToken, message?: string, percentage?: number): void;
  endWorkDone(token: ProgressToken): void;

  // --- Window: messages & documents ---
  logMessage(type: MessageType, message: string): void;
  showErrorMessage(
    message: string,
    ...actions: MessageActionItem[]
  ): Promise<MessageActionItem | undefined>;
  showWarningMessage(
    message: string,
    ...actions: MessageActionItem[]
  ): Promise<MessageActionItem | undefined>;
  showInformationMessage(
    message: string,
    ...actions: MessageActionItem[]
  ): Promise<MessageActionItem | undefined>;
  showDocument(params: ShowDocumentParams): Promise<ShowDocumentResult>;

  // --- Console (server process log; maps to connection.console) ---
  consoleLog(message: string): void;
  consoleInfo(message: string): void;
  consoleWarn(message: string): void;
  consoleError(message: string): void;
  consoleDebug(message: string): void;

  // --- Workspace (server→client requests) ---
  applyWorkspaceEdit(
    edit: ApplyWorkspaceEditParams | WorkspaceEdit
  ): Promise<ApplyWorkspaceEditResponse>;
  getConfiguration(items: ConfigurationItem[]): Promise<unknown[]>;
  getWorkspaceFolders(): Promise<WorkspaceFolder[] | null | undefined>;

  // --- Client capability registration ---
  registerCapabilities(registrations: Registration[]): Promise<void>;
  unregisterCapabilities(unregisterations: Unregistration[]): Promise<void>;

  // --- Language features (server→client) ---
  refreshSemanticTokens(): void;

  // --- Telemetry & trace ---
  logTelemetryEvent(data: Record<string, unknown>): void;
  logTrace(message: string, verbose?: string): void;
}
