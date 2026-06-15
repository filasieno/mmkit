import * as ihsm from "ihsm";
import { trace } from "@opentelemetry/api";
import {
  type InitializeParams,
  type InitializeResult,
  TextDocumentSyncKind,
} from "vscode-languageserver/node";
import { buildServerCapabilities } from "../../capabilities";
import { createLspHsm } from "../../../lsp/lsp-hsm-factory";
import type { LspServerContext } from "../../lsp-server-context";
import type { LspBindOptions } from "../../router/lsp-router";
import { otelLogger } from "../../../shared/telemetry/otel";
import { lspActorId } from "../../registry/lsp-actor-ids";
import { LSP_ACTOR_TYPE_IDS } from "../../registry/lsp-actor-type-ids";

const tracer = trace.getTracer("mmkit-lsp");

export interface InitializeRequestCtx {
  readonly typeId: typeof LSP_ACTOR_TYPE_IDS.initialize;
  server: LspServerContext;
  bindOptions: LspBindOptions;
  actorId: string;
  requestId: string | number;
  params: InitializeParams;
  result?: InitializeResult;
}

export interface InitializeRequestProtocol {
  start(): void;
  validateClient(): void;
  buildResult(): void;
}

export class InitializeTop extends ihsm.TopState<InitializeRequestCtx, InitializeRequestProtocol> {}

export class InitializeReceived extends InitializeTop {
  onEntry(): void {
    this.postNow("start");
  }

  start(): void {
    this.transition(InitializeRunning);
  }
}

export class InitializeRunning extends InitializeTop {
  onEntry(): void {
    this.postNow("validateClient");
  }

  validateClient(): void {
    const log = otelLogger("mmkit-lsp");
    tracer.startActiveSpan("lsp.initialize", (span) => {
      const textDocumentCaps = this.ctx.params.capabilities.textDocument as
        | { sync?: { change?: number } | number }
        | undefined;
      const clientSync = textDocumentCaps?.sync;
      const changeKind =
        typeof clientSync === "object" && clientSync !== null ? clientSync.change : clientSync;
      if (changeKind !== undefined && changeKind !== TextDocumentSyncKind.Incremental) {
        const msg = `conceptbase-lsp: client must use incremental sync (got ${String(changeKind)})`;
        this.ctx.server.actuators.consoleError(msg);
        log.emit({ severityText: "ERROR", body: msg });
      }
      span.setAttribute("client.incremental_sync", changeKind === TextDocumentSyncKind.Incremental);
      span.end();
    });
    this.postNow("buildResult");
  }

  buildResult(): void {
    this.ctx.server.metrics.lspInitialized.inc();
    this.ctx.bindOptions.readiness.lspInitialized = true;
    this.ctx.result = {
      capabilities: buildServerCapabilities({
        serverControl: true,
        otel: true,
        mcpHttpPort: Number(process.env.MMKIT_HTTP_PORT ?? "28080"),
      }),
    };
    this.transition(InitializeCompleted);
  }
}

export class InitializeCompleted extends InitializeTop {
  onEntry(): void {
    this.ctx.server.registry.remove(this.ctx.actorId);
  }
}

ihsm.InitialState(InitializeReceived);

ihsm.registerStateNames({
  InitializeReceived,
  InitializeRunning,
  InitializeCompleted,
});

export async function runInitializeRequest(
  server: LspServerContext,
  params: InitializeParams,
  bindOptions: LspBindOptions
): Promise<InitializeResult> {
  const requestId = server.registry.allocateId("initialize");
  const actorId = lspActorId("initialize", requestId);
  const ctx: InitializeRequestCtx = {
    typeId: LSP_ACTOR_TYPE_IDS.initialize,
    server,
    bindOptions,
    actorId,
    requestId,
    params,
  };
  const hsm = createLspHsm(InitializeTop, ctx);
  server.registry.register(actorId, LSP_ACTOR_TYPE_IDS.initialize, hsm, requestId);
  await hsm.sync();
  if (!ctx.result) {
    throw new Error("initialize HSM did not produce a result");
  }
  return ctx.result;
}
