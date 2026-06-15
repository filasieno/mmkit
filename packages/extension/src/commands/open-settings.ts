import type * as vscode from "vscode";
import { OPEN_SETTINGS_COMMAND } from "@mmkit/base";

export function registerOpenSettingsCommand(vscodeApi: typeof vscode, context: vscode.ExtensionContext): void {
  const disposable = vscodeApi.commands.registerCommand( OPEN_SETTINGS_COMMAND, () => { void vscodeApi.commands.executeCommand("workbench.action.openSettings", "@ext:conceptbase.mmkit"); } );
  context.subscriptions.push(disposable);
}
