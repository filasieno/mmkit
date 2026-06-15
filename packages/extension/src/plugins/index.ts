import type * as vscode from "vscode";
import type { IMmkitServerConfig } from "@mmkit/base";
import type { RawMmkitSettings } from "../settings/types";
import { configPlugin, getMmkitConfiguration, getMmkitServerConfig } from "./config.plugin";
import { CONFIG_PLUGIN_ID, MMKIT_PLUGIN_ACTIVATION_ORDER, MMKIT_PLUGIN_IDS, MMKIT_SINGLE_EXTENSION_MANIFEST } from "./manifest";
import type { MmkitPluginId } from "./manifest";
import type { MmkitAppPlugin, MmkitExtensionContext } from "./types";

/** All app plugins bundled into the single `mmkit` VS Code extension (activation order). */
export const MMKIT_APP_PLUGINS: readonly MmkitAppPlugin[] = [configPlugin] as const;

export type { MmkitPluginId };
export {
  CONFIG_PLUGIN_ID,
  MMKIT_PLUGIN_IDS,
  MMKIT_SINGLE_EXTENSION_MANIFEST,
  MMKIT_PLUGIN_ACTIVATION_ORDER,
};

export interface MmkitTestApi {
  getActivatedPluginIds(): readonly string[];
  getConfiguration(): RawMmkitSettings | undefined;
  getServerConfig(): IMmkitServerConfig | undefined;
}

let runtime: MmkitExtensionContext | undefined;
const activatedPluginIds: string[] = [];

function createRuntimeContext( vscodeApi: typeof vscode, extensionContext: vscode.ExtensionContext ): MmkitExtensionContext {
  return {
    vscode: vscodeApi,
    extensionContext,
  };
}

export function getMmkitRuntime(): MmkitExtensionContext | undefined {
  return runtime;
}

export function getMmkitTestApi(): MmkitTestApi {
  return {
    getActivatedPluginIds() {
      return [...activatedPluginIds];
    },
    getConfiguration() {
      return getMmkitConfiguration();
    },
    getServerConfig() {
      return getMmkitServerConfig();
    },
  };
}

/** Activate every mmkit app plugin in the single published extension. */
export async function activateMmkit( vscodeApi: typeof vscode, extensionContext: vscode.ExtensionContext ): Promise<MmkitTestApi> {
  if (runtime) {
    return getMmkitTestApi();
  }

  runtime = createRuntimeContext(vscodeApi, extensionContext);
  activatedPluginIds.length = 0;

  const order = MMKIT_APP_PLUGINS.map((plugin) => plugin.id);
  if (order.join("\0") !== [...MMKIT_PLUGIN_ACTIVATION_ORDER].join("\0")) {
    throw new Error(`mmkit plugin order mismatch: ${order.join(", ")}`);
  }

  for (const plugin of MMKIT_APP_PLUGINS) {
    await plugin.activate(runtime);
    activatedPluginIds.push(plugin.id);
  }

  return getMmkitTestApi();
}

/** Deactivate in reverse activation order. */
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
