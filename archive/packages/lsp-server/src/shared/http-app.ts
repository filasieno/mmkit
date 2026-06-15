import * as fs from "node:fs";
import * as path from "node:path";
import type { Server as HttpServer } from "node:http";
import type { Registry } from "prom-client";
import type { Request, Response } from "express";
import express from "express";
import { createMcpExpressApp } from "@modelcontextprotocol/express";
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node";
import type { McpServer } from "@modelcontextprotocol/server";
import type { ReadinessState } from "./telemetry/http";
import { otelLogger } from "./telemetry/otel";

// MCP mounted at POST /mcp — see mcp/docs/MCP-AI.md
// Docs mounted at GET /docs — see shared/docs-resolver.ts

export interface HttpAppOptions {
  readiness: ReadinessState;
  metricsRegistry: Registry;
  mcpServer: McpServer;
  /** Absolute path to share/doc/ from the `docs` Nix package (optional). */
  docsDir?: string;
}

// ── known HTML documents in the docs bundle ───────────────────────────────────

interface DocEntry {
  slug: string;
  title: string;
  description: string;
  html?: string;   // filename relative to docsDir, if HTML exists
  pdf?: string;    // filename relative to docsDir, if PDF exists
}

const KNOWN_DOCS: DocEntry[] = [
  {
    slug: "user-manual",
    title: "ConceptBase User Manual",
    description: "End-user reference: modules, frames, queries, client interfaces.",
    html: "doc-user-manual.html",
    pdf: "doc-user-manual.pdf",
  },
  {
    slug: "prog-manual",
    title: "ConceptBase Programmer Manual",
    description: "API, IPC protocol, extending the server.",
    html: "doc-prog-manual.html",
    pdf: "doc-prog-manual.pdf",
  },
  {
    slug: "tutorial",
    title: "ConceptBase Tutorial",
    description: "Step-by-step introduction to modelling with ConceptBase.",
    html: "doc-tutorial.html",
    pdf: "doc-tutorial.pdf",
  },
  {
    slug: "howto-manual",
    title: "ConceptBase HOW-TO Manual",
    description: "Task-oriented how-to guides.",
    pdf: "howto-manual.pdf",
  },
];

// ── index page ─────────────────────────────────────────────────────────────────

function buildDocsIndexHtml(baseUrl: string, docsDir: string): string {
  const rows = KNOWN_DOCS.map((doc) => {
    const htmlExists = doc.html && fs.existsSync(path.join(docsDir, doc.html));
    const pdfExists = doc.pdf && fs.existsSync(path.join(docsDir, doc.pdf));
    const htmlLink = htmlExists ? `<a href="${baseUrl}/${doc.html}">HTML</a>` : "";
    const pdfLink = pdfExists ? `<a href="${baseUrl}/${doc.pdf}">PDF</a>` : "";
    const links = [htmlLink, pdfLink].filter(Boolean).join(" &nbsp;·&nbsp; ");
    return `
      <tr>
        <td><strong>${doc.title}</strong><br><small>${doc.description}</small></td>
        <td>${links || "—"}</td>
      </tr>`;
  }).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>ConceptBase Documentation</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 860px; margin: 2rem auto; padding: 0 1rem; color: #222; }
    h1 { margin-bottom: .25rem; }
    p.sub { color: #555; margin-top: 0; }
    table { border-collapse: collapse; width: 100%; margin-top: 1.5rem; }
    th { text-align: left; border-bottom: 2px solid #ccc; padding: .5rem 0; color: #444; }
    td { padding: .6rem .4rem; border-bottom: 1px solid #eee; vertical-align: top; }
    a { color: #0060c0; }
    code { background: #f4f4f4; padding: .1rem .3rem; border-radius: 3px; font-size: .9em; }
  </style>
</head>
<body>
  <h1>ConceptBase Documentation</h1>
  <p class="sub">Served by mmkit at <code>${baseUrl}</code></p>

  <table>
    <thead><tr><th>Manual</th><th>Formats</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <h2>API endpoints</h2>
  <p>
    MCP tools: <code>POST /mcp</code><br>
    Health: <code>GET /healthz</code> &nbsp;·&nbsp; <code>GET /readyz</code><br>
    Metrics: <code>GET /metrics</code>
  </p>
</body>
</html>`;
}

// ── http app ───────────────────────────────────────────────────────────────────

export function startHttpApp(port: number, options: HttpAppOptions): HttpServer | undefined {
  if (process.env.MMKIT_HTTP_DISABLED === "1") {
    return undefined;
  }

  const log = otelLogger("mmkit-http");
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

  app.get("/metrics", async (_req: Request, res: Response) => {
    try {
      const body = await options.metricsRegistry.metrics();
      res.type(options.metricsRegistry.contentType).send(body);
    } catch (err) {
      log.emit({ severityText: "ERROR", body: "failed to render Prometheus metrics", attributes: { error: String(err) } });
      res.status(500).type("text/plain").send("metrics error");
    }
  });

  app.post("/mcp", async (req: Request, res: Response) => {
    const transport = new NodeStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await options.mcpServer.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  // ── docs ────────────────────────────────────────────────────────────────────
  const { docsDir } = options;
  if (docsDir && fs.existsSync(docsDir)) {
    const baseUrl = `http://localhost:${port}/docs`;

    app.get("/docs", (_req: Request, res: Response) => {
      res.type("text/html").send(buildDocsIndexHtml(baseUrl, docsDir));
    });

    // Serve all files (HTML, PDF, images, text) from the docs dir
    app.use("/docs", express.static(docsDir, { index: false, dotfiles: "ignore" }));

    log.emit({ severityText: "INFO", body: "ConceptBase docs served", attributes: { url: `${baseUrl}`, docsDir } });
  }

  const endpoints = ["/healthz", "/readyz", "/metrics", "/mcp", ...(docsDir ? ["/docs"] : [])];
  const server = app.listen(port, "0.0.0.0", () => {
    log.emit({ severityText: "INFO", body: "mmkit HTTP server listening", attributes: { port, endpoints } });
  });

  server.on("error", (err: NodeJS.ErrnoException) => {
    log.emit({ severityText: "WARN", body: "HTTP server unavailable", attributes: { port, error: err.message } });
  });

  return server;
}
