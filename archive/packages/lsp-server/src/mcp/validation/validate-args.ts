import { McpValidationError } from "./errors";

const MAX_STRING = 64_000;
const MAX_ARRAY = 256;
const MAX_PORT = 65_535;
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

export function requireObject(args: unknown, toolName: string): Record<string, unknown> {
  if (args === null || args === undefined) {
    return {};
  }
  if (typeof args !== "object" || Array.isArray(args)) {
    throw new McpValidationError(`${toolName}: arguments must be a JSON object`);
  }
  return args as Record<string, unknown>;
}

export function requireString(
  args: Record<string, unknown>,
  field: string,
  opts: { minLength?: number; maxLength?: number; allowEmpty?: boolean } = {}
): string {
  const raw = args[field];
  if (typeof raw !== "string") {
    throw new McpValidationError(`missing or invalid string field: ${field}`, field);
  }
  if (CONTROL_CHARS.test(raw)) {
    throw new McpValidationError(`field ${field} contains control characters`, field);
  }
  const max = opts.maxLength ?? MAX_STRING;
  if (raw.length > max) {
    throw new McpValidationError(`field ${field} exceeds ${max} characters`, field);
  }
  if (!opts.allowEmpty && raw.trim().length === 0) {
    throw new McpValidationError(`field ${field} must not be empty`, field);
  }
  if (opts.minLength !== undefined && raw.length < opts.minLength) {
    throw new McpValidationError(`field ${field} shorter than ${opts.minLength}`, field);
  }
  return raw;
}

export function optionalString(
  args: Record<string, unknown>,
  field: string,
  maxLength = MAX_STRING
): string | undefined {
  const raw = args[field];
  if (raw === undefined || raw === null) return undefined;
  return requireString(args, field, { maxLength, allowEmpty: false });
}

export function requireStringArray(args: Record<string, unknown>, field: string): string[] {
  const raw = args[field];
  if (!Array.isArray(raw)) {
    throw new McpValidationError(`field ${field} must be a string array`, field);
  }
  if (raw.length > MAX_ARRAY) {
    throw new McpValidationError(`field ${field} exceeds ${MAX_ARRAY} items`, field);
  }
  return raw.map((item, i) => {
    if (typeof item !== "string") {
      throw new McpValidationError(`field ${field}[${i}] must be a string`, field);
    }
    if (CONTROL_CHARS.test(item)) {
      throw new McpValidationError(`field ${field}[${i}] contains control characters`, field);
    }
    if (item.length > MAX_STRING) {
      throw new McpValidationError(`field ${field}[${i}] too long`, field);
    }
    return item;
  });
}

export function optionalPort(args: Record<string, unknown>, field: string): number | undefined {
  const raw = args[field];
  if (raw === undefined || raw === null) return undefined;
  return requirePort(args, field);
}

export function requirePort(args: Record<string, unknown>, field: string): number {
  const raw = args[field];
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 1 || raw > MAX_PORT) {
    throw new McpValidationError(`field ${field} must be an integer port 1–${MAX_PORT}`, field);
  }
  return raw;
}

export function requireAskFormat(value: string, field: string): "OBJNAMES" | "FRAMES" {
  if (value !== "OBJNAMES" && value !== "FRAMES") {
    throw new McpValidationError(`field ${field} must be OBJNAMES or FRAMES`, field);
  }
  return value;
}

export function requireIdentifier(value: string, field: string): string {
  if (!/^[A-Za-z][A-Za-z0-9_./-]*$/.test(value)) {
    throw new McpValidationError(`field ${field} has invalid identifier characters`, field);
  }
  return value;
}
