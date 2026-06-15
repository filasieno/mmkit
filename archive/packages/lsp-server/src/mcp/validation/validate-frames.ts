import { validateConceptBaseText } from "../../lsp/validate-conceptbase-text";
import { McpValidationError } from "./errors";
import { requireString } from "./validate-args";

/** Validate frame-bearing MCP arguments with tree-sitter when available. */
export async function requireValidFrames(
  args: Record<string, unknown>,
  field: string
): Promise<string> {
  const text = requireString(args, field, { allowEmpty: false });
  const result = await validateConceptBaseText(text);
  if (!result.ok) {
    const detail = result.issues.map((i) => i.message).join("; ");
    throw new McpValidationError(`invalid ConceptBase ${field}: ${detail}`, field, result.issues.map((i) => i.message));
  }
  return text;
}

export async function requireValidFramePair(
  args: Record<string, unknown>,
  untellField: string,
  tellField: string
): Promise<{ untellFrames: string; tellFrames: string }> {
  return {
    untellFrames: await requireValidFrames(args, untellField),
    tellFrames: await requireValidFrames(args, tellField),
  };
}
