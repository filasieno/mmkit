import { NODE_EDITOR_COMMAND } from "@mmkit/shared";
import { registerNodeEditorProvider } from "../node-editor/node-editor-provider";
import { openNodeEditor, registerVirtualNodeDocumentProvider } from "../node-editor/virtual-document";
import { NODE_EDITOR_PLUGIN_ID } from "./manifest";
import type { MmkitAppPlugin, MmkitExtensionContext } from "./types";

export { NODE_EDITOR_PLUGIN_ID };

export const nodeEditorPlugin: MmkitAppPlugin = {
  id: NODE_EDITOR_PLUGIN_ID,

  activate(ctx: MmkitExtensionContext): void {
    ctx.extensionContext.subscriptions.push(
      registerVirtualNodeDocumentProvider(),
      registerNodeEditorProvider(ctx.extensionContext),
      ctx.vscode.commands.registerCommand(NODE_EDITOR_COMMAND, () => {
        void openNodeEditor();
      })
    );
  },
};
