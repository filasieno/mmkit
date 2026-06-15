import type * as vscode from "vscode";

/** Shared activation state for mmkit app plugins in the single VS Code extension. */
export interface MmkitExtensionContext {
  vscode: typeof vscode;
  extensionContext: vscode.ExtensionContext;
}

/** One feature area registered from {@link extension.ts}. */
export interface MmkitAppPlugin {
  readonly id: string;
  activate(ctx: MmkitExtensionContext): void | Promise<void>;
  deactivate?(ctx: MmkitExtensionContext): void | Promise<void>;
}
