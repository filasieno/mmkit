import { LANGUAGE_ID, MMNB_VERSION } from "@mmkit/shared";

export interface MmnbCell {
  id: string;
  value: string;
}

export interface MmnbFile {
  mmkitVersion: number;
  cells: MmnbCell[];
}

function isMmnbCell(value: unknown): value is MmnbCell {
  if (!value || typeof value !== "object") return false;
  const cell = value as Record<string, unknown>;
  return typeof cell.id === "string" && typeof cell.value === "string";
}

export function parseMmnbBytes(bytes: Uint8Array): MmnbFile {
  const text = Buffer.from(bytes).toString("utf8");
  const parsed = JSON.parse(text) as unknown;
  if (!parsed || typeof parsed !== "object") {
    throw new Error("MM notebook: root must be an object");
  }
  const root = parsed as Record<string, unknown>;
  if (root.mmkitVersion !== MMNB_VERSION) {
    throw new Error(`MM notebook: unsupported mmkitVersion ${String(root.mmkitVersion)}`);
  }
  if (!Array.isArray(root.cells)) {
    throw new Error("MM notebook: cells must be an array");
  }
  const cells = root.cells.filter(isMmnbCell);
  if (cells.length !== root.cells.length) {
    throw new Error("MM notebook: only code cells with { id, value } are supported");
  }
  return { mmkitVersion: MMNB_VERSION, cells };
}

export interface SerializedCell {
  kind: "code";
  value: string;
  metadata?: { mmkitCellId?: string };
}

export function serializeMmnbCells(cells: SerializedCell[]): Uint8Array {
  const payload: MmnbFile = {
    mmkitVersion: MMNB_VERSION,
    cells: cells.map((cell, index) => {
      const id = cell.metadata?.mmkitCellId ?? `cell-${index + 1}`;
      return { id, value: cell.value };
    }),
  };
  return Buffer.from(JSON.stringify(payload, null, 2), "utf8");
}

export const CONCEPTBASE_LANGUAGE_ID = LANGUAGE_ID;
