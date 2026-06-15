import { trace } from "@opentelemetry/api";
import type { LspServerContext } from "../lsp-server-context";

const tracer = trace.getTracer("mmkit-lsp");

export async function publishDiagnosticsForUri(ctx: LspServerContext, uri: string): Promise<void> {
  await tracer.startActiveSpan("lsp.publishDiagnostics", async (span) => {
    span.setAttribute("document.uri", uri);
    await ctx.diagnosticsPublisher.publish(ctx.documentRegistry, uri);
    ctx.metrics.diagnosticsPublished.inc();
    span.end();
  });
}
