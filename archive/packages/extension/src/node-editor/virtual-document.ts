import { NODE_EDITOR_COMMAND, NODE_EDITOR_SCHEME, NODE_EDITOR_VIEW_TYPE } from "@mmkit/shared";
import * as vscode from "vscode";
import {
  defaultVirtualNodeDocument,
  parseVirtualNodeDocument,
  serializeVirtualNodeDocument,
  virtualNodePath,
  type VirtualNodeDocument,
} from "./virtual-document-core";

export type { VirtualNodeDocument };
export {
  defaultVirtualNodeDocument,
  parseVirtualNodeDocument,
  serializeVirtualNodeDocument,
  virtualNodePath,
} from "./virtual-document-core";

export function virtualNodeUri(nodeId?: string): vscode.Uri {
  return vscode.Uri.from({
    scheme: NODE_EDITOR_SCHEME,
    path: virtualNodePath(nodeId),
  });
}

export function registerVirtualNodeDocumentProvider(): vscode.Disposable {
  return vscode.workspace.registerTextDocumentContentProvider(NODE_EDITOR_SCHEME, {
    provideTextDocumentContent(uri) {
      const nodeId =
        uri.path.replace(/^\//, "").replace(/\.cbn$/, "") || "concept-browser";
      return serializeVirtualNodeDocument(defaultVirtualNodeDocument(nodeId));
    },
  });
}

export async function openNodeEditor(nodeId?: string): Promise<void> {
  const uri = virtualNodeUri(nodeId);
  await vscode.commands.executeCommand("vscode.openWith", uri, NODE_EDITOR_VIEW_TYPE);
}

export { NODE_EDITOR_COMMAND, NODE_EDITOR_VIEW_TYPE };
