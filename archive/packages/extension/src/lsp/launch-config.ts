import * as path from "node:path";
import * as vscode from "vscode";

export interface LanguageServerLaunchSettings {
  lspPort: number;
  httpPort: number;
  transport: "tcp" | "stdio";
}

const DEFAULTS: LanguageServerLaunchSettings = {
  lspPort: 16011,
  httpPort: 28080,
  transport: "tcp",
};

export function resolveLanguageServerLaunchSettings(
  context: vscode.ExtensionContext
): LanguageServerLaunchSettings {
  const config = vscode.workspace.getConfiguration("mmkit");
  const transport =
    context.extensionMode === vscode.ExtensionMode.Test ? "stdio" : DEFAULTS.transport;

  return {
    lspPort: config.get<number>("languageServer.lspPort", DEFAULTS.lspPort),
    httpPort: config.get<number>("languageServer.httpPort", DEFAULTS.httpPort),
    transport,
  };
}

export function buildDirectServerModule(context: vscode.ExtensionContext): string {
  return context.asAbsolutePath(path.join("server", "server.js"));
}

export function buildAssetRoot(context: vscode.ExtensionContext): string {
  return context.asAbsolutePath(path.join("assets", "cbserver"));
}
