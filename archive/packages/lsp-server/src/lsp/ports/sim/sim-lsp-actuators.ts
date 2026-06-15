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
import type { ApplyWorkspaceEditResponse } from "vscode-languageserver-protocol";
import type { LspActuators, ProgressNotificationValue } from "../lsp-actuators";

export interface RecordedProgress {
  token: ProgressToken;
  value: ProgressNotificationValue;
}

export interface RecordedShowMessage {
  level: "error" | "warning" | "information";
  message: string;
  actions: MessageActionItem[];
}

export class SimLspActuators implements LspActuators {
  readonly diagnostics = new Map<string, Diagnostic[]>();
  readonly progress: RecordedProgress[] = [];
  readonly logMessages: Array<{ type: MessageType; message: string }> = [];
  readonly showMessages: RecordedShowMessage[] = [];
  readonly showDocuments: ShowDocumentParams[] = [];
  readonly consoleLogLines: string[] = [];
  readonly consoleInfoLines: string[] = [];
  readonly consoleWarnLines: string[] = [];
  readonly consoleErrorLines: string[] = [];
  readonly consoleDebugLines: string[] = [];
  readonly workspaceEdits: Array<ApplyWorkspaceEditParams | WorkspaceEdit> = [];
  readonly configurationRequests: ConfigurationItem[][] = [];
  workspaceFolderRequestCount = 0;
  readonly capabilityRegistrations: Registration[][] = [];
  readonly capabilityUnregistrations: Unregistration[][] = [];
  semanticTokenRefreshCount = 0;
  readonly telemetryEvents: Record<string, unknown>[] = [];
  readonly traceLogs: Array<{ message: string; verbose?: string }> = [];

  throwOn: Partial<Record<keyof LspActuators, Error>> = {};

  /** Simulated responses for client-request actuators. */
  configurationResponse: unknown[] = [];
  workspaceFoldersResponse: WorkspaceFolder[] | null | undefined = null;
  applyEditResponse: ApplyWorkspaceEditResponse = { applied: true };
  showDocumentResponse: ShowDocumentResult = { success: true };
  showMessageResponse: MessageActionItem | undefined = undefined;

  private guard(method: keyof LspActuators): void {
    const err = this.throwOn[method];
    if (err) throw err;
  }

  publishDiagnostics(uri: string, diagnostics: Diagnostic[]): void {
    this.guard("publishDiagnostics");
    this.diagnostics.set(uri, diagnostics);
  }

  sendProgress(token: ProgressToken, value: ProgressNotificationValue): void {
    this.guard("sendProgress");
    this.progress.push({ token, value });
  }

  beginWorkDone(token: ProgressToken, title: string, cancellable?: boolean): void {
    this.guard("beginWorkDone");
    this.sendProgress(token, { kind: "begin", title, cancellable });
  }

  reportWorkDone(token: ProgressToken, message?: string, percentage?: number): void {
    this.guard("reportWorkDone");
    this.sendProgress(token, { kind: "report", message, percentage });
  }

  endWorkDone(token: ProgressToken): void {
    this.guard("endWorkDone");
    this.sendProgress(token, { kind: "end" });
  }

  logMessage(type: MessageType, message: string): void {
    this.guard("logMessage");
    this.logMessages.push({ type, message });
  }

  showErrorMessage(
    message: string,
    ...actions: MessageActionItem[]
  ): Promise<MessageActionItem | undefined> {
    this.guard("showErrorMessage");
    this.showMessages.push({ level: "error", message, actions });
    return Promise.resolve(this.showMessageResponse);
  }

  showWarningMessage(
    message: string,
    ...actions: MessageActionItem[]
  ): Promise<MessageActionItem | undefined> {
    this.guard("showWarningMessage");
    this.showMessages.push({ level: "warning", message, actions });
    return Promise.resolve(this.showMessageResponse);
  }

  showInformationMessage(
    message: string,
    ...actions: MessageActionItem[]
  ): Promise<MessageActionItem | undefined> {
    this.guard("showInformationMessage");
    this.showMessages.push({ level: "information", message, actions });
    return Promise.resolve(this.showMessageResponse);
  }

  showDocument(params: ShowDocumentParams): Promise<ShowDocumentResult> {
    this.guard("showDocument");
    this.showDocuments.push(params);
    return Promise.resolve(this.showDocumentResponse);
  }

  consoleLog(message: string): void {
    this.guard("consoleLog");
    this.consoleLogLines.push(message);
  }

  consoleInfo(message: string): void {
    this.guard("consoleInfo");
    this.consoleInfoLines.push(message);
  }

  consoleWarn(message: string): void {
    this.guard("consoleWarn");
    this.consoleWarnLines.push(message);
  }

  consoleError(message: string): void {
    this.guard("consoleError");
    this.consoleErrorLines.push(message);
  }

  consoleDebug(message: string): void {
    this.guard("consoleDebug");
    this.consoleDebugLines.push(message);
  }

  applyWorkspaceEdit(
    edit: ApplyWorkspaceEditParams | WorkspaceEdit
  ): Promise<ApplyWorkspaceEditResponse> {
    this.guard("applyWorkspaceEdit");
    this.workspaceEdits.push(edit);
    return Promise.resolve(this.applyEditResponse);
  }

  getConfiguration(items: ConfigurationItem[]): Promise<unknown[]> {
    this.guard("getConfiguration");
    this.configurationRequests.push(items);
    return Promise.resolve(this.configurationResponse);
  }

  getWorkspaceFolders(): Promise<WorkspaceFolder[] | null | undefined> {
    this.guard("getWorkspaceFolders");
    this.workspaceFolderRequestCount += 1;
    return Promise.resolve(this.workspaceFoldersResponse);
  }

  registerCapabilities(registrations: Registration[]): Promise<void> {
    this.guard("registerCapabilities");
    this.capabilityRegistrations.push(registrations);
    return Promise.resolve();
  }

  unregisterCapabilities(unregisterations: Unregistration[]): Promise<void> {
    this.guard("unregisterCapabilities");
    this.capabilityUnregistrations.push(unregisterations);
    return Promise.resolve();
  }

  refreshSemanticTokens(): void {
    this.guard("refreshSemanticTokens");
    this.semanticTokenRefreshCount += 1;
  }

  logTelemetryEvent(data: Record<string, unknown>): void {
    this.guard("logTelemetryEvent");
    this.telemetryEvents.push(data);
  }

  logTrace(message: string, verbose?: string): void {
    this.guard("logTrace");
    this.traceLogs.push({ message, verbose });
  }

  workDoneSequence(token: ProgressToken): ProgressNotificationValue[] {
    return this.progress.filter((p) => p.token === token).map((p) => p.value);
  }
}
