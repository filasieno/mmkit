import { DEFAULT_MMKIT_SERVER_NETWORK, MmkitServerConfig } from "@mmkit/base";
import type { IMmkitClientConfig, IMmkitConfiguration, IMmkitLanguageServerConfig, IMmkitOperationalConfig, IMmkitServerConfig, MmkitServerUpdateMode } from "@mmkit/base";
import type { RawMmkitSettings } from "./types";

/**
 * Map VS Code workspace settings into {@link IMmkitServerConfig} for {@link @mmkit/server}.
 */
export function toMmkitServerConfig(raw: RawMmkitSettings): MmkitServerConfig {
  return new MmkitServerConfig( { launch: { executablePath: raw.server.executablePath, devCommand: raw.server.devCommand, autoStartup: false, extraArgs: [...raw.server.extraArgs], }, network: { port: raw.server.port, portProbeMaxAttempts: DEFAULT_MMKIT_SERVER_NETWORK.portProbeMaxAttempts, portProbeIntervalMs: DEFAULT_MMKIT_SERVER_NETWORK.portProbeIntervalMs, portProbeConnectTimeoutMs: DEFAULT_MMKIT_SERVER_NETWORK.portProbeConnectTimeoutMs, }, paths: { dataDir: raw.server.dataDir, updateMode: raw.server.updateMode as MmkitServerUpdateMode, databasePath: raw.server.databasePath, databaseAllPath: raw.server.databaseAllPath, newDatabasePath: raw.server.newDatabasePath, resetOnStart: raw.server.resetOnStart, tmpDir: raw.server.tmpDir, loadDir: raw.server.loadDir, saveDir: raw.server.saveDir, viewsDir: raw.server.viewsDir, }, mmkit: { clientToolName: raw.client.toolName, clientUserName: raw.client.userName, }, } );
}

/** Map workspace settings into the operational config group. */
export function toOperationalConfig(raw: RawMmkitSettings): IMmkitOperationalConfig {
  return {
    operationalMode: raw.operationalMode,
    traceLevel: raw.traceLevel,
  };
}

/** Map workspace settings into the language-server config group. */
export function toLanguageServerConfig(raw: RawMmkitSettings): IMmkitLanguageServerConfig {
  return { ...raw.languageServer };
}

/** Map workspace settings into the TCP client config group. */
export function toClientConfig(raw: RawMmkitSettings): IMmkitClientConfig {
  return { ...raw.client };
}

/**
 * Map the full VS Code property sheet into {@link IMmkitConfiguration}.
 */
export function toMmkitConfiguration(raw: RawMmkitSettings): IMmkitConfiguration {
  return {
    operational: toOperationalConfig(raw),
    languageServer: toLanguageServerConfig(raw),
    server: toMmkitServerConfig(raw),
    client: toClientConfig(raw),
  };
}
