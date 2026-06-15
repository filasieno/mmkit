import type { CbAnswer } from "@mmkit/shared";
import { McpValidationError } from "./errors";

export type ToolResult = CbAnswer | { completion: "ok"; ok: true; result?: string };
export type McpContent = { content: Array<{ type: "text"; text: string }>; isError?: boolean };

export function jsonText(value: unknown): McpContent {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

export function validationResponse(err: McpValidationError): McpContent {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          { ok: false, error: "validation_failed", message: err.message, field: err.field, issues: err.issues },
          null,
          2
        ),
      },
    ],
    isError: true,
  };
}

function wrapError(toolName: string, err: unknown): McpContent {
  if (err instanceof McpValidationError) return validationResponse(err);
  const message = err instanceof Error ? err.message : String(err);
  return {
    content: [{ type: "text", text: JSON.stringify({ ok: false, error: "tool_failed", tool: toolName, message }, null, 2) }],
    isError: true,
  };
}

/**
 * Wraps a tool's `run` callback: JSON-encodes the result on success, and on any
 * throw converts `McpValidationError` → `validation_failed` and everything else
 * → `tool_failed`. Used by the declarative registration loop in
 * `register-cb-tools.ts`, so individual tool entries stay pure logic.
 */
export async function guardedTool<T>(toolName: string, run: () => Promise<T>): Promise<McpContent> {
  try {
    return jsonText(await run());
  } catch (err) {
    return wrapError(toolName, err);
  }
}
