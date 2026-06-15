import * as http from "node:http";
import type { Registry } from "prom-client";
import { otelLogger } from "./otel";

export interface ReadinessState {
  started: boolean;
  lspInitialized: boolean;
}

export function startTelemetryHttpServer(
  port: number,
  readiness: ReadinessState,
  metricsRegistry: Registry
): http.Server | undefined {
  if (process.env.MMKIT_HTTP_DISABLED === "1") {
    return undefined;
  }

  const log = otelLogger("mmkit-lsp-http");

  const server = http.createServer(async (req, res) => {
    const path = req.url?.split("?")[0] ?? "/";

    if (path === "/healthz" || path === "/health") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("ok");
      return;
    }

    if (path === "/readyz" || path === "/ready") {
      // Ready when the LSP transport is accepting connections (stdio bound or TCP
      // listening). Do not require lspInitialized — compose/VS Code probes before
      // the LanguageClient connects.
      if (readiness.started) {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("ready");
        return;
      }
      res.writeHead(503, { "Content-Type": "text/plain" });
      res.end("not ready");
      return;
    }

    if (path === "/metrics") {
      try {
        const body = await metricsRegistry.metrics();
        res.writeHead(200, { "Content-Type": metricsRegistry.contentType });
        res.end(body);
      } catch (err) {
        log.emit({
          severityText: "ERROR",
          body: "failed to render Prometheus metrics",
          attributes: { error: String(err) },
        });
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("metrics error");
      }
      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("not found");
  });

  server.on("error", (err) => {
    log.emit({
      severityText: "WARN",
      body: "telemetry HTTP server unavailable — LSP continues without scrape endpoints",
      attributes: { port, error: err.message },
    });
  });

  server.listen(port, "0.0.0.0", () => {
    log.emit({
      severityText: "INFO",
      body: "telemetry HTTP server listening",
      attributes: { port, endpoints: ["/healthz", "/readyz", "/metrics"] },
    });
  });

  return server;
}
