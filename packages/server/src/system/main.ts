#!/usr/bin/env node
import { startHttpApp } from "../http/http-app";
import { startLspTcp } from "../lsp/lsp-server";
import { createMcpServer } from "../mcp/mcp-server";

async function main(): Promise<void> {
  const httpPort = Number(process.env.MMKIT_HTTP_PORT ?? "28080");
  const lspPort = Number(process.env.MMKIT_LSP_PORT ?? "16011");
  const readiness = { started: false };
  const mcpServer = createMcpServer(async () => "cbserver-archived");
  const httpServer = startHttpApp(httpPort, { readiness, mcpServer });
  const lspServer = startLspTcp(lspPort);

  const shutdown = async (signal: string) => {
    console.log(`mmkit-server shutting down (${signal})`);
    httpServer.close();
    lspServer.close();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  console.log(`mmkit-server listening http=${httpPort} lsp=${lspPort} cbserver=archived`,);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
