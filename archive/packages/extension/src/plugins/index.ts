import type * as vscode from "vscode";
import { State as LanguageClientState } from "vscode-languageclient/node";
import type { ConnectionTestResult } from "../commands/connection-test";
import { getLanguageClient, getMmkitServerPanelState } from "../lsp/client";
import type { ConfigActorCtx } from "../actors/config-actor";
import { ACTOR_IDS } from "../registry";
import { supervisorPlugin } from "./supervisor.plugin";
import { languageToolingPlugin } from "./language-tooling.plugin";
import {
  SUPERVISOR_PLUGIN_ID,
  LANGUAGE_TOOLING_PLUGIN_ID,
  MMKIT_PLUGIN_ACTIVATION_ORDER,
  MMKIT_PLUGIN_IDS,
  MMKIT_SINGLE_EXTENSION_MANIFEST,
  NODE_EDITOR_PLUGIN_ID,
  PANEL_PLUGIN_ID,
  TRACE_PLUGIN_ID,
  type MmkitPluginId,
} from "./manifest";
import { nodeEditorPlugin } from "./node-editor.plugin";
import { panelPlugin } from "./panel.plugin";
import { tracePlugin } from "./trace.plugin";
import type { MmkitAppPlugin, MmkitExtensionContext } from "./types";

/** All app plugins bundled into the single `mmkit` VS Code extension (activation order). */
export const MMKIT_APP_PLUGINS: readonly MmkitAppPlugin[] = [
  tracePlugin,
  supervisorPlugin,
  panelPlugin,
  nodeEditorPlugin,
  languageToolingPlugin,
] as const;

export type { MmkitPluginId };
export {
  TRACE_PLUGIN_ID,
  LANGUAGE_TOOLING_PLUGIN_ID,
  PANEL_PLUGIN_ID,
  SUPERVISOR_PLUGIN_ID,
  NODE_EDITOR_PLUGIN_ID,
  MMKIT_PLUGIN_IDS,
  MMKIT_SINGLE_EXTENSION_MANIFEST,
  MMKIT_PLUGIN_ACTIVATION_ORDER,
};

export interface MmkitTestApi {
  getActorState(actorId: string): string | undefined;
  getSupervisorState(): string | undefined;
  getMmkitServerPanelState(): string;
  runConnectionTest(): Promise<ConnectionTestResult>;
  getLanguageClientState(): LanguageClientState | undefined;
  getActivatedPluginIds(): readonly string[];
  getConfigDataDir(): string | undefined;
}

let runtime: MmkitExtensionContext | undefined;
const activatedPluginIds: string[] = [];

function createRuntimeContext(
  vscodeApi: typeof vscode,
  extensionContext: vscode.ExtensionContext
): MmkitExtensionContext {
  return {
    vscode: vscodeApi,
    extensionContext,
    traceChannel: undefined as unknown as vscode.OutputChannel,
    logHub: undefined as unknown as MmkitExtensionContext["logHub"],
    registry: undefined as unknown as MmkitExtensionContext["registry"],
    ports: undefined as unknown as MmkitExtensionContext["ports"],
    supervisorCtx: undefined as unknown as MmkitExtensionContext["supervisorCtx"],
  };
}

export function getMmkitRuntime(): MmkitExtensionContext | undefined {
  return runtime;
}

export function getMmkitTestApi(): MmkitTestApi {
  return {
    getActorState(actorId: string) {
      return runtime?.registry?.get(actorId)?.currentStateName;
    },
    getSupervisorState() {
      return runtime?.supervisor?.currentStateName;
    },
    async runConnectionTest() {
      if (!runtime?.ports || !runtime.logHub) {
        return {
          ok: false,
          message: "mmkit is not activated",
          query: "exists[Class/objname]",
          error: "not activated",
        };
      }
      const { runConnectionTest } = await import("../commands/connection-test");
      const raw = runtime.ports.vscodeConfig.readConfiguration();
      const host = raw.operationalMode === "client" ? raw.client.host : "127.0.0.1";
      const port = raw.operationalMode === "client" ? raw.client.port : raw.server.port;
      return runConnectionTest({
        ports: runtime.ports,
        host,
        port,
        toolName: raw.client.toolName,
        userName: raw.client.userName,
        connectTimeoutMs: raw.client.connectTimeoutMs,
        trace: runtime.logHub.forActor("connection.test"),
      });
    },
    getLanguageClientState() {
      return getLanguageClient()?.state;
    },
    getMmkitServerPanelState() {
      return getMmkitServerPanelState();
    },
    getActivatedPluginIds() {
      return [...activatedPluginIds];
    },
    getConfigDataDir() {
      const ctx = runtime?.registry?.get(ACTOR_IDS.config)?.ctx as ConfigActorCtx | undefined;
      return ctx?.snapshot?.paths.dataDir;
    },
  };
}

/** Activate every mmkit app plugin in the single published extension. */
export async function activateMmkit(
  vscodeApi: typeof vscode,
  extensionContext: vscode.ExtensionContext
): Promise<MmkitTestApi> {
  if (runtime) {
    return getMmkitTestApi();
  }

  runtime = createRuntimeContext(vscodeApi, extensionContext);
  activatedPluginIds.length = 0;

  const order = MMKIT_APP_PLUGINS.map((p) => p.id);
  if (order.join("\0") !== [...MMKIT_PLUGIN_ACTIVATION_ORDER].join("\0")) {
    throw new Error(`mmkit plugin order mismatch: ${order.join(", ")}`);
  }

  for (const plugin of MMKIT_APP_PLUGINS) {
    await plugin.activate(runtime);
    activatedPluginIds.push(plugin.id);
  }

  return getMmkitTestApi();
}

/** Deactivate in reverse order (LSP → node editor → panel → supervisor → trace). */
export async function deactivateMmkit(): Promise<void> {
  if (!runtime) return;

  const ctx = runtime;
  for (const plugin of [...MMKIT_APP_PLUGINS].reverse()) {
    if (plugin.deactivate) {
      await plugin.deactivate(ctx);
    }
  }

  runtime = undefined;
  activatedPluginIds.length = 0;
}

export { ACTOR_IDS };
