import type { McpServer } from "@modelcontextprotocol/server";
import type { ServerSupervisor } from "../cbserver/supervisor/server-supervisor";
import { CbMcpSession } from "./cb-session";
import { requireObject } from "./validation/validate-args";
import { guardedTool } from "./validation/tool-guard";
import { allCBTools, type CBToolContext } from "./tools/cb-tool";
// Side-effect import: loading the module runs every `MCPTool()` registration,
// which populates the catalog read by `allCBTools()`.
import "./tools/cb-tools";

/**
 * Registers all ConceptBase MCP tools on `server`.
 *
 * Each tool is registered via `MCPTool()` in `tools/cb-tools.ts`. This class
 * owns the shared context (`supervisor`, `session`, lazy `client()`) and the
 * single registration loop: for every tool it parses + validates `raw`, runs
 * `exec`, and wraps the result via `guardedTool` (JSON encode on success,
 * `validation_failed` / `tool_failed` on throw).
 */
export class CBToolRegistry {
  private readonly ctx: CBToolContext;

  constructor(supervisor: ServerSupervisor) {
    const session = new CbMcpSession(supervisor);
    this.ctx = { supervisor, session, client: () => session.getClient() };
  } 

  register(server: McpServer): void {
    for (const tool of allCBTools()) {
      server.registerTool(tool.name, { title: tool.title, description: tool.description }, (raw) =>
        guardedTool(tool.name, () => tool.exec(this.ctx, requireObject(raw, tool.name)))
      );
    }
  }
}
