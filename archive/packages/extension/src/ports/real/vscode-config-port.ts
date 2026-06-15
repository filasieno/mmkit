import * as vscode from "vscode";
import { DEFAULT_CLIENT, DEFAULT_RAW, DEFAULT_SERVER, parseOperationalMode } from "../../config/schema";
import { parseOtelTraceLevel } from "../../logging/trace-level";
import type { ClientSettings, RawMmkitSettings, ServerSettings } from "../../types";
import type { VscodeConfigPort } from "../types";

function readServer(config: vscode.WorkspaceConfiguration): ServerSettings {
  return {
    autoStartup: config.get<boolean>("server.autoStartup", DEFAULT_SERVER.autoStartup),
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
    traceMode: config.get<string>("server.traceMode", DEFAULT_SERVER.traceMode),
    untellMode: config.get<string>("server.untellMode", DEFAULT_SERVER.untellMode),
    cacheMode: config.get<string>("server.cacheMode", DEFAULT_SERVER.cacheMode),
    cacheSize: config.get<string>("server.cacheSize", DEFAULT_SERVER.cacheSize),
    optimizerMode: config.get<string>("server.optimizerMode", DEFAULT_SERVER.optimizerMode),
    viewsMaintenance: config.get<string>("server.viewsMaintenance", DEFAULT_SERVER.viewsMaintenance),
    restartDelaySeconds: config.get<string>("server.restartDelaySeconds", DEFAULT_SERVER.restartDelaySeconds),
    securityLevel: config.get<string>("server.securityLevel", DEFAULT_SERVER.securityLevel),
    maxErrors: config.get<string>("server.maxErrors", DEFAULT_SERVER.maxErrors),
    adminUser: config.get<string>("server.adminUser", DEFAULT_SERVER.adminUser),
    multiUser: config.get<boolean>("server.multiUser", DEFAULT_SERVER.multiUser),
    moduleSeparator: config.get<string>("server.moduleSeparator", DEFAULT_SERVER.moduleSeparator),
    moduleGeneration: config.get<string>("server.moduleGeneration", DEFAULT_SERVER.moduleGeneration),
    ccMode: config.get<string>("server.ccMode", DEFAULT_SERVER.ccMode),
    maxCost: config.get<string>("server.maxCost", DEFAULT_SERVER.maxCost),
    pathLength: config.get<string>("server.pathLength", DEFAULT_SERVER.pathLength),
    iterMax: config.get<string>("server.iterMax", DEFAULT_SERVER.iterMax),
    ecaMode: config.get<string>("server.ecaMode", DEFAULT_SERVER.ecaMode),
    ecaOptimizer: config.get<string>("server.ecaOptimizer", DEFAULT_SERVER.ecaOptimizer),
    ruleLabels: config.get<string>("server.ruleLabels", DEFAULT_SERVER.ruleLabels),
    inactivityHours: config.get<string>("server.inactivityHours", DEFAULT_SERVER.inactivityHours),
    serverMode: config.get<string>("server.serverMode", DEFAULT_SERVER.serverMode),
    stratificationMode: config.get<string>("server.stratificationMode", DEFAULT_SERVER.stratificationMode),
    devCommand: config.get<string>("server.devCommand", DEFAULT_SERVER.devCommand),
    extraArgs: config.get<string[]>("server.extraArgs", DEFAULT_SERVER.extraArgs),
  };
}

function readClient(config: vscode.WorkspaceConfiguration): ClientSettings {
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

export class RealVscodeConfigPort implements VscodeConfigPort {
  readConfiguration(resource?: vscode.Uri): RawMmkitSettings {
    const config = vscode.workspace.getConfiguration("mmkit", resource);
    return {
      operationalMode: parseOperationalMode(config.get<string>("operationalMode", DEFAULT_RAW.operationalMode)),
      traceLevel: parseOtelTraceLevel(config.get<string>("traceLevel", DEFAULT_RAW.traceLevel)),
      server: readServer(config),
      client: readClient(config),
    };
  }

  async executeUpdate(patch: Record<string, unknown>, resource?: vscode.Uri): Promise<void> {
    const config = vscode.workspace.getConfiguration("mmkit", resource);
    for (const [key, value] of Object.entries(patch)) {
      await config.update(key, value, vscode.ConfigurationTarget.Workspace);
    }
  }
}
