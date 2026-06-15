import { setPanelPortBridge } from "../ports/real/panel-port";
import { registerMmkitPanelProvider } from "../ui/mmkit-panel-provider";
import { PANEL_PLUGIN_ID } from "./manifest";
import type { MmkitAppPlugin, MmkitExtensionContext } from "./types";

export { PANEL_PLUGIN_ID };

let panelProvider: ReturnType<typeof registerMmkitPanelProvider> | undefined;

export const panelPlugin: MmkitAppPlugin = {
  id: PANEL_PLUGIN_ID,

  activate(ctx: MmkitExtensionContext): void {
    panelProvider = registerMmkitPanelProvider(ctx.extensionContext);
    setPanelPortBridge(panelProvider);
  },

  deactivate(): void {
    setPanelPortBridge(undefined);
    panelProvider = undefined;
  },
};
