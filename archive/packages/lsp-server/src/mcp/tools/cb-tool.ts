import type { CbTcpClient } from "../cb-tcp-client";
import type { CbMcpSession } from "../cb-session";
import type { ServerSupervisor } from "../../cbserver/supervisor/server-supervisor";

/** Shared context handed to every tool. */
export interface CBToolContext {
  readonly supervisor: ServerSupervisor;
  readonly session: CbMcpSession;
  /** Lazily enroll (or reuse) the shared TCP client for the current session. */
  client(): Promise<CbTcpClient>;
}

/**
 * A tool routine: validate `raw` (e.g. via the `require*` / `requireValid*`
 * helpers, which throw `McpValidationError`) and perform the operation. Returns
 * a plain value and may throw freely — error handling and JSON encoding are
 * applied uniformly by the registration loop.
 */
export type CBToolExec = (ctx: CBToolContext, raw: Record<string, unknown>) => Promise<unknown>;

/** MCP metadata for a tool. */
export interface CBToolMeta {
  readonly name: string;
  readonly title: string;
  readonly description: string;
}

/** A registered tool = its MCP metadata plus its routine. */
export interface CBTool extends CBToolMeta {
  readonly exec: CBToolExec;
}

const REGISTERED_TOOLS: CBTool[] = [];

/**
 * Registers one ConceptBase MCP tool into the global catalog — no manual
 * `ALL_CB_TOOLS` array to keep in sync. The metadata lives alongside the
 * routine, so the routine is just a plain function:
 *
 * ```ts
 * MCPTool(
 *   { name: "cb_tell", title: "Tell frames", description: "…" },
 *   async (ctx, raw) => (await ctx.client()).tell(await requireValidFrames(raw, "frames")),
 * );
 * ```
 *
 * Registration order follows call order within the module. The module must be
 * imported (even for side effects) for the tools to appear; see
 * `register-cb-tools.ts`.
 */
export function MCPTool(meta: CBToolMeta, exec: CBToolExec): void {
  REGISTERED_TOOLS.push({ ...meta, exec });
}

/** Every registered tool, in call order. */
export function allCBTools(): readonly CBTool[] {
  return REGISTERED_TOOLS;
}
