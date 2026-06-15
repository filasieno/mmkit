import type * as vscode from "vscode";
import type { RawMmkitSettings } from "./types";
import { DEFAULT_CLIENT, DEFAULT_LANGUAGE_SERVER, DEFAULT_RAW, DEFAULT_SERVER } from "./defaults";
import { parseLanguageServerTrace, parseOperationalMode, parseOtelTraceLevel } from "./schema";

function readServer(config: vscode.WorkspaceConfiguration): RawMmkitSettings["server"] {
  return {
    launchKind: config.get<"executable" | "docker">("server.launchKind", DEFAULT_SERVER.launchKind),
    executablePath: config.get<string>("server.executablePath", DEFAULT_SERVER.executablePath),
    dockerImage: config.get<string>("server.dockerImage", DEFAULT_SERVER.dockerImage),
    dockerContainerName: config.get<string>("server.dockerContainerName", DEFAULT_SERVER.dockerContainerName),
    dockerExtraRunArgs: config.get<string[]>("server.dockerExtraRunArgs", DEFAULT_SERVER.dockerExtraRunArgs),
    dataDir: config.get<string>("server.dataDir", DEFAULT_SERVER.dataDir),
    port: config.get<number>("server.port", DEFAULT_SERVER.port),
    updateMode: config.get<string>("server.updateMode", DEFAULT_SERVER.updateMode),
    databasePath: config.get<string>("server.databasePath", DEFAULT_SERVER.databasePath),
    databaseAllPath: config.get<string>("server.databaseAllPath", DEFAULT_SERVER.databaseAllPath),
    newDatabasePath: config.get<string>("server.newDatabasePath", DEFAULT_SERVER.newDatabasePath),
    resetOnStart: config.get<boolean>("server.resetOnStart", DEFAULT_SERVER.resetOnStart),
    tmpDir: config.get<string>("server.tmpDir", DEFAULT_SERVER.tmpDir),
    loadDir: config.get<string>("server.loadDir", DEFAULT_SERVER.loadDir),
    saveDir: config.get<string>("server.saveDir", DEFAULT_SERVER.saveDir),
    viewsDir: config.get<string>("server.viewsDir", DEFAULT_SERVER.viewsDir),
    devCommand: config.get<string>("server.devCommand", DEFAULT_SERVER.devCommand),
    extraArgs: config.get<string[]>("server.extraArgs", DEFAULT_SERVER.extraArgs),
  };
}

function readClient(config: vscode.WorkspaceConfiguration): RawMmkitSettings["client"] {
  return {
    host: config.get<string>("client.host", DEFAULT_CLIENT.host),
    port: config.get<number>("client.port", DEFAULT_CLIENT.port),
    toolName: config.get<string>("client.toolName", DEFAULT_CLIENT.toolName),
    userName: config.get<string>("client.userName", DEFAULT_CLIENT.userName),
    connectTimeoutMs: config.get<number>("client.connectTimeoutMs", DEFAULT_CLIENT.connectTimeoutMs),
    autoConnect: config.get<boolean>("client.autoConnect", DEFAULT_CLIENT.autoConnect),
    autoReconnect: config.get<boolean>("client.autoReconnect", DEFAULT_CLIENT.autoReconnect),
    reconnectBackoffMs: config.get<number>("client.reconnectBackoffMs", DEFAULT_CLIENT.reconnectBackoffMs),
  };
}

function readLanguageServer(config: vscode.WorkspaceConfiguration): RawMmkitSettings["languageServer"] {
  return {
    trace: parseLanguageServerTrace(config.get<string>("languageServer.trace", DEFAULT_LANGUAGE_SERVER.trace)),
    lspPort: config.get<number>("languageServer.lspPort", DEFAULT_LANGUAGE_SERVER.lspPort),
    httpPort: config.get<number>("languageServer.httpPort", DEFAULT_LANGUAGE_SERVER.httpPort),
  };
}

/** Read the current mmkit property sheet from VS Code workspace configuration. */
export function readMmkitConfiguration( vscodeApi: typeof vscode, resource?: vscode.Uri ): RawMmkitSettings {
  const config = vscodeApi.workspace.getConfiguration("mmkit", resource);
  return {
    operationalMode: parseOperationalMode(config.get<string>("operationalMode", DEFAULT_RAW.operationalMode)),
    traceLevel: parseOtelTraceLevel(config.get<string>("traceLevel", DEFAULT_RAW.traceLevel)),
    languageServer: readLanguageServer(config),
    server: readServer(config),
    client: readClient(config),
  };
}
