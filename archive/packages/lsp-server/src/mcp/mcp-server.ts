import { McpServer } from "@modelcontextprotocol/server";
import type { ServerSupervisor } from "../cbserver/supervisor/server-supervisor";
import { CBToolRegistry } from "./register-cb-tools";

export { MCP_CB_TOOL_NAMES } from "./mcp-tool-names";

export function createMmkitMcpServer(supervisor: ServerSupervisor): McpServer {
  const server = new McpServer({
    name: "mmkit",
    version: "0.2.0",
  });

  new CBToolRegistry(supervisor).register(server);

  return server;
}
