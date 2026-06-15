import { NODE_EDITOR_EXTENSION, NODE_EDITOR_SCHEME } from "@mmkit/shared";

export interface VirtualNodeUri {
  readonly scheme: string;
  readonly path: string;
}

export interface VirtualNodeDocument {
  readonly kind: "conceptbase-browser";
  readonly version: 1;
  readonly title: string;
  readonly nodeId: string;
}

const DEFAULT_NODE_ID = "concept-browser";

export function virtualNodePath(nodeId = DEFAULT_NODE_ID): string {
  return `/${nodeId}${NODE_EDITOR_EXTENSION}`;
}

export function virtualNodeUriParts(nodeId = DEFAULT_NODE_ID): VirtualNodeUri {
  return { scheme: NODE_EDITOR_SCHEME, path: virtualNodePath(nodeId) };
}

export function parseVirtualNodeDocument(uri: VirtualNodeUri, raw: string): VirtualNodeDocument {
  try {
    const parsed = JSON.parse(raw) as Partial<VirtualNodeDocument>;
    if (parsed.kind === "conceptbase-browser" && parsed.version === 1 && parsed.nodeId && parsed.title) {
      return {
        kind: "conceptbase-browser",
        version: 1,
        title: parsed.title,
        nodeId: parsed.nodeId,
      };
    }
  } catch {
    // fall through to default payload for unknown or legacy buffers
  }
  const nodeId = uri.path.replace(/^\//, "").replace(new RegExp(`${NODE_EDITOR_EXTENSION}$`), "") || DEFAULT_NODE_ID;
  return {
    kind: "conceptbase-browser",
    version: 1,
    title: "ConceptBase Browser",
    nodeId,
  };
}

export function serializeVirtualNodeDocument(doc: VirtualNodeDocument): string {
  return `${JSON.stringify(doc, null, 2)}\n`;
}

export function defaultVirtualNodeDocument(nodeId = DEFAULT_NODE_ID): VirtualNodeDocument {
  return {
    kind: "conceptbase-browser",
    version: 1,
    title: "ConceptBase Browser",
    nodeId,
  };
}
