import type { IMmkitConfiguration, IMmkitServerConfig } from "@mmkit/base";
import type { RawMmkitSettings } from "../settings/types";
import { registerOpenSettingsCommand } from "../commands/open-settings";
import { readMmkitConfiguration } from "../settings/read-configuration";
import { toMmkitConfiguration, toMmkitServerConfig } from "../settings/to-server-config";
import { CONFIG_PLUGIN_ID } from "./manifest";
import type { MmkitAppPlugin, MmkitExtensionContext } from "./types";

export { CONFIG_PLUGIN_ID };

let cachedSettings: RawMmkitSettings | undefined;
let cachedServerConfig: IMmkitServerConfig | undefined;
let cachedConfiguration: IMmkitConfiguration | undefined;

export function getMmkitConfiguration(): RawMmkitSettings | undefined {
  return cachedSettings;
}

export function getMmkitServerConfig(): IMmkitServerConfig | undefined {
  return cachedServerConfig;
}

export function getMmkitRuntimeConfiguration(): IMmkitConfiguration | undefined {
  return cachedConfiguration;
}

function refreshConfiguration(vscodeApi: MmkitExtensionContext["vscode"]): void {
  cachedSettings = readMmkitConfiguration(vscodeApi);
  cachedServerConfig = toMmkitServerConfig(cachedSettings);
  cachedConfiguration = toMmkitConfiguration(cachedSettings);
}

export const configPlugin: MmkitAppPlugin = {
  id: CONFIG_PLUGIN_ID,

  activate(ctx: MmkitExtensionContext): void {
    refreshConfiguration(ctx.vscode);
    registerOpenSettingsCommand(ctx.vscode, ctx.extensionContext);

    const listener = ctx.vscode.workspace.onDidChangeConfiguration( (event) => { if (event.affectsConfiguration("mmkit")) { refreshConfiguration(ctx.vscode); } } );
    ctx.extensionContext.subscriptions.push(listener);
  },

  deactivate(): void {
    cachedSettings = undefined;
    cachedServerConfig = undefined;
    cachedConfiguration = undefined;
  },
};
