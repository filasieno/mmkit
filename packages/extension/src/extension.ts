import * as vscode from "vscode";
import { registerHelloWorldCommand } from "./commands/hello-world";
import { activateMmkit, deactivateMmkit } from "./plugins";

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  registerHelloWorldCommand(vscode, context);
  await activateMmkit(vscode, context);
}

export async function deactivate(): Promise<void> {
  await deactivateMmkit();
}
