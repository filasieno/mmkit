declare module "@modelcontextprotocol/server" {
  export class McpServer {
    constructor(opts: { name: string; version: string });
    registerTool(
      name: string,
      schema: Record<string, unknown>,
      handler: (args?: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }> }>
    ): void;
    connect(transport: unknown): Promise<void>;
  }
}

declare module "@modelcontextprotocol/express" {
  import type { Express } from "express";
  export function createMcpExpressApp(opts?: { host?: string }): Express;
}

declare module "@modelcontextprotocol/node" {
  export class NodeStreamableHTTPServerTransport {
    constructor(opts?: { sessionIdGenerator?: undefined });
    handleRequest(req: unknown, res: unknown, body: unknown): Promise<void>;
  }
}
