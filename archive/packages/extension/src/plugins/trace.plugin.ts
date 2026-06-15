import { DEFAULT_RAW } from "../config/schema";
import { createOutputChannel, MmkitLogHub, setGlobalOtelTraceLevel } from "../logging/trace";
import { parseOtelTraceLevel } from "../logging/trace-level";
import { TRACE_PLUGIN_ID } from "./manifest";
import type { MmkitAppPlugin, MmkitExtensionContext } from "./types";

export { TRACE_PLUGIN_ID };

export const tracePlugin: MmkitAppPlugin = {
  id: TRACE_PLUGIN_ID,

  activate(ctx: MmkitExtensionContext): void {
    const level = parseOtelTraceLevel(
      ctx.vscode.workspace.getConfiguration("mmkit").get<string>("traceLevel", DEFAULT_RAW.traceLevel)
    );
    setGlobalOtelTraceLevel(level);

    const channel = createOutputChannel(ctx.vscode);
    ctx.extensionContext.subscriptions.push(channel);
    ctx.traceChannel = channel;

    ctx.logHub = new MmkitLogHub(channel);
    ctx.logHub.setMinLevel(level);
  },
};
