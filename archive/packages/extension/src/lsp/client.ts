import * as vscode from "vscode";
import {
  CloseAction,
  ErrorAction,
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  Trace,
  TransportKind,
} from "vscode-languageclient/node";
import { StreamMessageReader, StreamMessageWriter } from "vscode-jsonrpc/node";
import { buildDocumentSelector } from "./client-config";
import {
  buildAssetRoot,
  buildDirectServerModule,
  resolveLanguageServerLaunchSettings,
  type LanguageServerLaunchSettings,
} from "./launch-config";
import {
  connectLspSocket,
  serverProcessEnv,
  spawnLanguageServerProcess,
  stopServerProcess,
  waitForHttpReady,
  type ServerProcessHandle,
} from "./server-process";
import {
  panelStateFromPhase,
  registerMmkitLspBridge,
  sendConfigUpdate,
  sendServerStart,
  sendServerStop,
  type MmkitServerStateListener,
} from "./mmkit-lsp-bridge";
import { traceFromConfigurationValue } from "./trace-bridge";
import type { ConfigSnapshot } from "../types";

let client: LanguageClient | undefined;
let serverProcess: ServerProcessHandle | undefined;
let lspOutputChannel: vscode.OutputChannel | undefined;
let mmkitServerPhaseListener: MmkitServerStateListener | undefined;
let lastMmkitServerPanelState = "Idle";

export { buildDocumentSelector } from "./client-config";

export function getLanguageClient(): LanguageClient | undefined {
  return client;
}

export function getLspOutputChannel(): vscode.OutputChannel | undefined {
  return lspOutputChannel;
}

export function getMmkitServerPanelState(): string {
  return lastMmkitServerPanelState;
}

export function setMmkitServerStateListener(listener: MmkitServerStateListener | undefined): void {
  mmkitServerPhaseListener = listener;
}

export function resolveLspTraceLevel(config = vscode.workspace.getConfiguration("mmkit")): Trace {
  return traceFromConfigurationValue(config.get<string>("languageServer.trace", "off")) as Trace;
}

export function buildLanguageClientOptions(
  context: vscode.ExtensionContext,
  outputChannel: vscode.OutputChannel
): LanguageClientOptions {
  return {
    documentSelector: buildDocumentSelector(),
    synchronize: {
      configurationSection: "mmkit.languageServer",
      fileEvents: vscode.workspace.createFileSystemWatcher("**/*.{cbs,mmnb}"),
    },
    outputChannel,
    initializationOptions: {
      supportsSemanticTokens: true,
    },
    markdown: {
      isTrusted: true,
      supportHtml: false,
    },
    errorHandler: {
      error: () => ({ action: ErrorAction.Continue }),
      closed: () => ({ action: CloseAction.DoNotRestart }),
    },
  };
}

function isTestMode(context: vscode.ExtensionContext): boolean {
  return context.extensionMode === vscode.ExtensionMode.Test;
}

export function buildServerOptions(
  context: vscode.ExtensionContext,
  settings: LanguageServerLaunchSettings
): ServerOptions {
  if (settings.transport === "tcp" && !isTestMode(context)) {
    return async () => {
      const serverModule = buildDirectServerModule(context);
      const assetRoot = buildAssetRoot(context);
      serverProcess = spawnLanguageServerProcess(serverModule, settings, assetRoot, false);
      await waitForHttpReady("127.0.0.1", settings.httpPort);
      const socket = await connectLspSocket(settings.lspPort);
      return {
        reader: new StreamMessageReader(socket),
        writer: new StreamMessageWriter(socket),
        detached: true,
      };
    };
  }

  const serverModule = buildDirectServerModule(context);
  const assetRoot = buildAssetRoot(context);
  const testMode = isTestMode(context);
  const processEnv = serverProcessEnv(settings, assetRoot, testMode);
  return {
    run: { module: serverModule, transport: TransportKind.stdio, options: { env: processEnv } },
    debug: {
      module: serverModule,
      transport: TransportKind.stdio,
      options: { execArgv: ["--nolazy", "--inspect=6010"], env: processEnv },
    },
  };
}

export async function startLanguageClient(context: vscode.ExtensionContext): Promise<LanguageClient> {
  if (client) return client;

  lspOutputChannel = vscode.window.createOutputChannel("ConceptBase LSP");
  context.subscriptions.push(lspOutputChannel);

  const launchSettings = resolveLanguageServerLaunchSettings(context);
  const clientOptions = buildLanguageClientOptions(context, lspOutputChannel);
  const serverOptions = buildServerOptions(context, launchSettings);

  client = new LanguageClient(
    "conceptbase",
    "ConceptBase Language Server",
    serverOptions,
    clientOptions
  );

  registerMmkitLspBridge(client, (notification) => {
    lastMmkitServerPanelState = panelStateFromPhase(notification.phase);
    mmkitServerPhaseListener?.(notification);
  });

  client.setTrace(resolveLspTraceLevel());
  await client.start();
  context.subscriptions.push(client);

  const traceListener = vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration("mmkit.languageServer.trace") && client) {
      client.setTrace(resolveLspTraceLevel());
    }
  });
  context.subscriptions.push(traceListener);

  return client;
}

export async function pushConfigToLanguageServer(snapshot: ConfigSnapshot): Promise<void> {
  if (!client) return;
  await sendConfigUpdate(client, snapshot);
}

export async function requestMmkitServerStart(snapshot: ConfigSnapshot): Promise<void> {
  if (!client) {
    throw new Error("Language client not running");
  }
  await sendServerStart(client, snapshot);
}

export async function requestMmkitServerStop(): Promise<void> {
  if (!client) return;
  await sendServerStop(client);
}

export async function restartLanguageClient(context: vscode.ExtensionContext): Promise<LanguageClient> {
  await stopLanguageClient();
  return startLanguageClient(context);
}

export async function stopLanguageClient(): Promise<void> {
  if (client) {
    try {
      await client.stop();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      lspOutputChannel?.appendLine(`ConceptBase LSP stop: ${message}`);
    }
    client = undefined;
  }

  await stopServerProcess(serverProcess);
  serverProcess = undefined;
  lastMmkitServerPanelState = "Idle";
}
