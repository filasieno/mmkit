/** Prefix for in-flight LSP request / notification actor ids. */
export const LSP_ACTOR_PREFIX = "lsp";

export function lspActorId(method: string, requestId: string | number): string {
  const safeMethod = method.replace(/\//g, ".");
  return `${LSP_ACTOR_PREFIX}.${safeMethod}.${String(requestId)}`;
}
