import { McpServer } from "@modelcontextprotocol/server";
export function createMcpServer(readState: () => Promise<string>): McpServer {
  const server = new McpServer({ name: "mmkit", version: "0.2.0" });

  server.registerTool("mmkit_server_status", { title: "MMKit server status", description: "Returns the current cbserver ihsm state name." }, async () => ({ content: [{ type: "text", text: JSON.stringify({ state: await readState() }) }] }));

  return server;
}
