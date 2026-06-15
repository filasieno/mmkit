/**
 * Notebook sidecar for LSP `notebookDocument/*` events.
 *
 * Cell text still lives in {@link DocumentRegistry} under virtual cell URIs;
 * this registry tracks notebook structure (cell list, notebook version).
 */
export interface NotebookRecord {
  readonly uri: string;
  /** LSP notebook document version (monotonic per notebook URI). */
  version: number;
  readonly notebookType: string;
  /** ConceptBase code-cell document URIs, stable order. */
  cellUris: string[];
}

export type NotebookVersionResult =
  | { ok: true; record: NotebookRecord }
  | { ok: false; reason: "unknown-uri" | "stale-version" | "version-gap" };

export class NotebookRegistry {
  private readonly notebooks = new Map<string, NotebookRecord>();
  private readonly cellToNotebook = new Map<string, string>();

  trackOpen(uri: string, version: number, notebookType: string, cellUris: string[]): NotebookVersionResult {
    const prev = this.notebooks.get(uri);
    if (prev && version <= prev.version) {
      return { ok: false, reason: "stale-version" };
    }
    if (prev) {
      for (const cell of prev.cellUris) {
        this.cellToNotebook.delete(cell);
      }
    }
    const record: NotebookRecord = { uri, version, notebookType, cellUris: [...cellUris] };
    this.notebooks.set(uri, record);
    for (const cell of cellUris) {
      this.cellToNotebook.set(cell, uri);
    }
    return { ok: true, record };
  }

  trackChange(
    uri: string,
    nextVersion: number,
    cellUris?: string[]
  ): NotebookVersionResult {
    const record = this.notebooks.get(uri);
    if (!record) return { ok: false, reason: "unknown-uri" };
    if (nextVersion <= record.version) return { ok: false, reason: "stale-version" };
    if (nextVersion > record.version + 1) return { ok: false, reason: "version-gap" };

    for (const cell of record.cellUris) {
      this.cellToNotebook.delete(cell);
    }
    record.version = nextVersion;
    if (cellUris) {
      record.cellUris = [...cellUris];
    }
    for (const cell of record.cellUris) {
      this.cellToNotebook.set(cell, uri);
    }
    return { ok: true, record };
  }

  trackClose(uri: string): void {
    const record = this.notebooks.get(uri);
    if (record) {
      for (const cell of record.cellUris) {
        this.cellToNotebook.delete(cell);
      }
    }
    this.notebooks.delete(uri);
  }

  get(uri: string): NotebookRecord | undefined {
    return this.notebooks.get(uri);
  }

  findNotebookForCell(cellUri: string): NotebookRecord | undefined {
    const nbUri = this.cellToNotebook.get(cellUri);
    if (!nbUri) return undefined;
    return this.notebooks.get(nbUri);
  }

  entries(): NotebookRecord[] {
    return [...this.notebooks.values()];
  }
}
