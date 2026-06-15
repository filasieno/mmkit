import { registerNotebookSerializer } from "../notebook/serializer";
import { LANGUAGE_TOOLING_PLUGIN_ID } from "./manifest";
import type { MmkitAppPlugin, MmkitExtensionContext } from "./types";

export { LANGUAGE_TOOLING_PLUGIN_ID };

export const languageToolingPlugin: MmkitAppPlugin = {
  id: LANGUAGE_TOOLING_PLUGIN_ID,

  activate(ctx: MmkitExtensionContext): void {
    registerNotebookSerializer(ctx.extensionContext);
  },
};
