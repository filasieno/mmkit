import { createExtensionSupervisor } from "../actors/extension-supervisor";
import { type ConnectionTestResult, runConnectionTest } from "../commands/connection-test";
import { getGlobalOtelTraceLevel } from "../logging/trace";
import { parseOtelTraceLevel } from "../logging/trace-level";
import { createPorts } from "../ports";
import { ACTOR_IDS, ActorRegistry } from "../registry";
import { createStatusBar } from "../ui/status-bar";
import { SUPERVISOR_PLUGIN_ID } from "./manifest";
import type { MmkitAppPlugin, MmkitExtensionContext } from "./types";

export { SUPERVISOR_PLUGIN_ID };

async function executeConnectionTest(ctx: MmkitExtensionContext): Promise<ConnectionTestResult> {
  const raw = ctx.ports.vscodeConfig.readConfiguration();
  const host = raw.operationalMode === "client" ? raw.client.host : "127.0.0.1";
  const port = raw.operationalMode === "client" ? raw.client.port : raw.server.port;
  return runConnectionTest({
    ports: ctx.ports,
    host,
    port,
    toolName: raw.client.toolName,
    userName: raw.client.userName,
    connectTimeoutMs: raw.client.connectTimeoutMs,
    trace: ctx.logHub.forActor("connection.test"),
  });
}

async function runConnectionTestCommand(ctx: MmkitExtensionContext): Promise<void> {
  const result = await executeConnectionTest(ctx);
  const trace = ctx.logHub.forActor("connection.test");
  if (result.ok) {
    trace.info("connection test OK", { query: result.query, reply: result.reply });
  } else {
    trace.error("connection test failed", { query: result.query, error: result.error, reply: result.reply });
  }
  void ctx.vscode.commands.executeCommand("mmkit.showTrace");
  if (result.ok) {
    await ctx.vscode.window.showInformationMessage(`mmkit connection test: ${result.message}`);
    return;
  }
  await ctx.vscode.window.showErrorMessage(`mmkit connection test failed: ${result.message}`);
}

function postSupervisor(ctx: MmkitExtensionContext, event: string, ...args: unknown[]): void {
  if (!ctx.supervisor) return;
  (ctx.supervisor.post as (name: string, ...a: unknown[]) => void)(event, ...args);
}

function refreshStatusBar(ctx: MmkitExtensionContext): void {
  const supervisor = ctx.supervisor;
  const statusBar = ctx.supervisorCtx?.statusBar;
  if (!supervisor || !statusBar || !ctx.registry) return;
  const lsCtx = ctx.registry.get(ACTOR_IDS.languageServer)?.ctx as
    | { mmkitServerPanelState?: string }
    | undefined;
  statusBar.update(
    {
      mode: ctx.supervisorCtx.mode,
      server: lsCtx?.mmkitServerPanelState ?? "Idle",
      client: ctx.registry.get(ACTOR_IDS.client)?.currentStateName,
      languageServer: ctx.registry.get(ACTOR_IDS.languageServer)?.currentStateName,
      supervisor: supervisor.currentStateName,
    },
    ctx.supervisorCtx.snapshot
  );
}

function startSupervisorSyncPump(ctx: MmkitExtensionContext): void {
  const timer = setInterval(() => {
    void ctx.registry?.syncAll();
    void ctx.supervisor?.sync();
    refreshStatusBar(ctx);
  }, 16);
  ctx.extensionContext.subscriptions.push({ dispose: () => clearInterval(timer) });
}

async function registrySafeSync(ctx: MmkitExtensionContext): Promise<void> {
  if (!ctx.supervisor) return;
  const deadline = Date.now() + 16_000;
  while (Date.now() < deadline) {
    await ctx.supervisor.sync();
    if (ctx.supervisor.currentStateName === "Inactive") return;
    await new Promise((r) => setTimeout(r, 50));
  }
}

export const supervisorPlugin: MmkitAppPlugin = {
  id: SUPERVISOR_PLUGIN_ID,

  async activate(ctx: MmkitExtensionContext): Promise<void> {
    ctx.registry = new ActorRegistry(ctx.logHub);
    ctx.ports = createPorts("real", ctx.extensionContext);
    const trace = ctx.logHub.forActor(ACTOR_IDS.supervisor);
    const statusBar = createStatusBar(ctx.vscode);
    statusBar.showImmediately();

    ctx.supervisorCtx = {
      ports: ctx.ports,
      registry: ctx.registry,
      trace,
      vscode: ctx.vscode,
      extensionContext: ctx.extensionContext,
      disposables: [],
      mode: "none",
      statusBar,
    };

    ctx.supervisor = createExtensionSupervisor(ctx.supervisorCtx);
    ctx.registry.register(ACTOR_IDS.supervisor, ctx.supervisor as never);

    const register = (command: string, handler: () => void) => {
      const d = ctx.vscode.commands.registerCommand(command, handler);
      ctx.extensionContext.subscriptions.push(d);
      ctx.supervisorCtx.disposables.push(d);
    };

    register("mmkit.startServer", () => postSupervisor(ctx, "hostCommand", "mmkit.startServer"));
    register("mmkit.stopServer", () => postSupervisor(ctx, "hostCommand", "mmkit.stopServer"));
    register("mmkit.connect", () => postSupervisor(ctx, "hostCommand", "mmkit.connect"));
    register("mmkit.disconnect", () => postSupervisor(ctx, "hostCommand", "mmkit.disconnect"));
    register("mmkit.openSettings", () => postSupervisor(ctx, "hostCommand", "mmkit.openSettings"));
    register("mmkit.showTrace", () => ctx.traceChannel.show(true));
    register("mmkit.connectionTest", () => {
      void runConnectionTestCommand(ctx);
    });
    register("mmkit.restartLanguageServer", () => postSupervisor(ctx, "hostCommand", "mmkit.restartLanguageServer"));
    register("mmkit.newNotebook", () => {
      void (async () => {
        const data = new ctx.vscode.NotebookData([
          new ctx.vscode.NotebookCellData(ctx.vscode.NotebookCellKind.Code, "", "conceptbase"),
        ]);
        const doc = await ctx.vscode.workspace.openNotebookDocument("mmkit.conceptbase-notebook", data);
        await ctx.vscode.window.showNotebookDocument(doc);
      })();
    });

    const configListener = ctx.vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("mmkit")) {
        if (e.affectsConfiguration("mmkit.traceLevel")) {
          const level = parseOtelTraceLevel(ctx.vscode.workspace.getConfiguration("mmkit").get("traceLevel"));
          ctx.registry.applyTraceLevel(level);
          postSupervisor(ctx, "traceLevelChanged", level);
        }
        postSupervisor(ctx, "hostConfigurationChanged");
      }
    });
    ctx.extensionContext.subscriptions.push(configListener);
    ctx.supervisorCtx.disposables.push(configListener);

    startSupervisorSyncPump(ctx);
    postSupervisor(ctx, "hostActivated", ctx.extensionContext);
    trace.log("info", "Metamodelling Kit activating — state machines started", {
      traceLevel: getGlobalOtelTraceLevel(),
    });
  },

  async deactivate(ctx: MmkitExtensionContext): Promise<void> {
    if (!ctx.supervisor) return;
    postSupervisor(ctx, "hostDeactivating");
    await ctx.supervisor.sync();
    await registrySafeSync(ctx);
    ctx.supervisor = undefined;
    ctx.registry = undefined as unknown as ActorRegistry;
    ctx.ports = undefined as unknown as ReturnType<typeof createPorts>;
  },
};
