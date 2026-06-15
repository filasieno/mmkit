/**
 * Single VS Code extension entry — all mmkit app plugins activate via {@link activateMmkit}.
 *
 * Bundled capabilities (one VSIX, one `main`):
 * - ConceptBase cbserver lifecycle (ServerManager / ClientManager actors) — activates early
 * - MMKit activity-bar panel + ConceptBase browser (node editor)
 * - LSP client → bundled `@mmkit/lsp-server` process (background start)
 * - MM notebook serializer, `.cbs` language (package.json contributes)
 * - Command palette + status bar
 */
import * as vscode from "vscode";
import { activateMmkit, deactivateMmkit, getMmkitTestApi, type MmkitTestApi } from "./plugins";

export type { MmkitTestApi };
export { getMmkitTestApi };

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const api = await activateMmkit(vscode, context);
  return api as unknown as Thenable<void>;
}

export async function deactivate(): Promise<void> {
  await deactivateMmkit();
}
