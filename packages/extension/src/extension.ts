import * as vscode from "vscode";
import { registerHelloWorldCommand } from "./commands/hello-world";

export function activate(context: vscode.ExtensionContext): void {
  registerHelloWorldCommand(vscode, context);
}

export function deactivate(): void {}
