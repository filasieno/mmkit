import { startHttpApp } from "./shared/http-app";
import { startLspStdio, startLspTcp } from "./lsp/lsp-app";
import { createMmkitMcpServer } from "./mcp/mcp-server";
import { createRealPorts } from "./shared/ports";
import { CustomHandlerRegistry } from "./cbserver/supervisor/custom-handler-registry";
import { ServerSupervisor } from "./cbserver/supervisor/server-supervisor";
import { createLspMetrics } from "./shared/telemetry/metrics";
import { initOpenTelemetry, otelLogger, shutdownOpenTelemetry } from "./shared/telemetry/otel";
import type { ReadinessState } from "./shared/telemetry/http";

async function main(): Promise<void> {
  const transport = (process.env.MMKIT_LSP_TRANSPORT ?? "tcp").toLowerCase();
  const httpPort = Number(process.env.MMKIT_HTTP_PORT ?? "28080");
  const lspPort = Number(process.env.MMKIT_LSP_PORT ?? "16011");
  const log = otelLogger("mmkit-lsp");

  initOpenTelemetry();

  const readiness: ReadinessState = { started: false, lspInitialized: false };
  const metrics = createLspMetrics();
  const customHandlers = new CustomHandlerRegistry();
  const ports = createRealPorts();

  let activeConnection: import("vscode-languageserver/node").Connection | undefined;
  let activeActuators: import("./lsp/ports/lsp-actuators").LspActuators | undefined;

  const supervisor = new ServerSupervisor({
    ports,
    registry: customHandlers,
    getConnection: () => activeConnection,
    getActuators: () => activeActuators,
  });
  supervisor.start();

  const mcpServer = createMmkitMcpServer(supervisor);
  const httpServer = startHttpApp(httpPort, {
    readiness,
    metricsRegistry: metrics.registry,
    mcpServer,
  });

  const bindOptions = {
    readiness,
    metrics,
    supervisor,
    customHandlers,
  };

  const wireConnection = (
    connection: import("vscode-languageserver/node").Connection,
    actuators: import("./lsp/ports/lsp-actuators").LspActuators
  ): void => {
    activeConnection = connection;
    activeActuators = actuators;
  };

  if (transport === "tcp") {
    startLspTcp(lspPort, bindOptions, wireConnection);
    log.emit({
      severityText: "INFO",
      body: "mmkit LSP started in TCP mode",
      attributes: { lspPort, httpPort },
    });
  } else {
    const server = startLspStdio(bindOptions);
    wireConnection(server.connection, server.actuators);
    log.emit({
      severityText: "INFO",
      body: "mmkit LSP started in stdio mode",
      attributes: { httpPort },
    });
  }

  const shutdown = async (signal: string) => {
    log.emit({ severityText: "INFO", body: "shutting down", attributes: { signal } });
    await supervisor.shutdown();
    httpServer?.close();
    await shutdownOpenTelemetry();
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("mmkit-lsp fatal:", err);
  process.exit(1);
});
