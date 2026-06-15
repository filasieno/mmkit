export class McpValidationError extends Error {
  constructor(
    message: string,
    readonly field?: string,
    readonly issues?: string[]
  ) {
    super(message);
    this.name = "McpValidationError";
  }
}

export function validationError(message: string, field?: string): never {
  throw new McpValidationError(message, field);
}
