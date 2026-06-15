import type * as vscode from "vscode";
import { HELLO_WORLD_COMMAND, HELLO_WORLD_MESSAGE } from "@mmkit/base";

export function registerHelloWorldCommand(vscodeApi: typeof vscode, context: vscode.ExtensionContext): void {
  const disposable = vscodeApi.commands.registerCommand( HELLO_WORLD_COMMAND, () => { return vscodeApi.window.showInformationMessage(HELLO_WORLD_MESSAGE); } );
  context.subscriptions.push(disposable);
}
