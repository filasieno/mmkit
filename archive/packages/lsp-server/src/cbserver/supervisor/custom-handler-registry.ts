export type CustomHandler = (params: unknown) => Promise<unknown>;

export class CustomHandlerRegistry {
  private readonly handlers = new Map<string, CustomHandler>();

  register(method: string, handler: CustomHandler): void {
    this.handlers.set(method, handler);
  }

  has(method: string): boolean {
    return this.handlers.has(method);
  }

  async dispatch(method: string, params: unknown): Promise<unknown> {
    const handler = this.handlers.get(method);
    if (!handler) {
      throw new Error(`no handler for ${method}`);
    }
    return handler(params);
  }
}
