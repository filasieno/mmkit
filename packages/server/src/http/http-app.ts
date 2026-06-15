import type { Server as HttpServer } from "node:http";
import type { Request, Response } from "express";
import express from "express";
import { createMcpExpressApp } from "@modelcontextprotocol/express";
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node";
import type { McpServer } from "@modelcontextprotocol/server";

export interface HttpAppOptions {
  readiness: { started: boolean };
  mcpServer: McpServer;
}

export function startHttpApp(port: number, options: HttpAppOptions): HttpServer {
  const app = createMcpExpressApp({ host: "0.0.0.0" });

  app.use(express.json({ limit: "4mb" }));

  app.get(["/healthz", "/health"], (_req: Request, res: Response) => {
    res.type("text/plain").send("ok");
  });

  app.get(["/readyz", "/ready"], (_req: Request, res: Response) => {
    if (options.readiness.started) {
      res.type("text/plain").send("ready");
      return;
    }
    res.status(503).type("text/plain").send("not ready");
  });

  app.post("/mcp", async (req: Request, res: Response) => {
    const transport = new NodeStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await options.mcpServer.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  return app.listen(port, "0.0.0.0", () => {
    options.readiness.started = true;
  });
}
