import type * as vscode from "vscode";
import type { createExtensionSupervisor } from "../actors/extension-supervisor";
import type { ExtensionSupervisorCtx } from "../actors/extension-supervisor";
import type { MmkitLogHub } from "../logging/trace";
import type { MmkitPorts } from "../ports/types";
import type { ActorRegistry } from "../registry";

/** Shared activation state for all mmkit app plugins in the single VS Code extension. */
export interface MmkitExtensionContext {
  vscode: typeof vscode;
  extensionContext: vscode.ExtensionContext;
  traceChannel: vscode.OutputChannel;
  logHub: MmkitLogHub;
  registry: ActorRegistry;
  ports: MmkitPorts;
  supervisorCtx: ExtensionSupervisorCtx;
  supervisor?: ReturnType<typeof createExtensionSupervisor>;
}

/** One feature area registered from {@link extension.ts} (cbserver, LSP, panel, …). */
export interface MmkitAppPlugin {
  readonly id: string;
  activate(ctx: MmkitExtensionContext): void | Promise<void>;
  deactivate?(ctx: MmkitExtensionContext): void | Promise<void>;
}
