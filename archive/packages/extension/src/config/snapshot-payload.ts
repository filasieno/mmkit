import type { ConfigSnapshotPayload } from "@mmkit/shared";
import type { ConfigSnapshot } from "../types";

/** Strip VS Code-specific fields for LSP/MCP RPC (JSON-safe — no Uri / ExtensionContext). */
export function toConfigSnapshotPayload(snapshot: ConfigSnapshot): ConfigSnapshotPayload {
  return JSON.parse(
    JSON.stringify({
      generation: snapshot.generation,
      operationalMode: snapshot.operationalMode,
      traceLevel: snapshot.traceLevel,
      server: snapshot.server,
      client: snapshot.client,
      paths: snapshot.paths,
      valid: snapshot.valid,
      errors: snapshot.errors,
    })
  ) as ConfigSnapshotPayload;
}
