import type { TextDocument, TextDocumentContentChangeEvent } from "vscode-languageserver-textdocument";
import { TextDocument as TextDocumentImpl } from "vscode-languageserver-textdocument";
import { toConceptBaseDocument, type ConceptBaseDocument } from "./conceptbase-document";
import type { ParseTree } from "./tree-sitter/runtime";

/**
 * ## Versioning strategy
 *
 * LSP assigns a monotonically increasing integer `version` per open document.
 * The registry mirrors {@link TextDocuments} from `vscode-languageserver-textdocument`:
 *
 * 1. **Open** — store buffer + record `version`; tree is absent until first parse.
 * 2. **Change** — client sends `contentChanges` + `nextVersion`. We apply deltas via
 *    `TextDocument.update` only when `nextVersion > storedVersion`. Stale or duplicate
 *    versions are rejected (out-of-order delivery after reconnect).
 * 3. **Close** — drop buffer, tree, and version entry.
 *
 * The CST map is keyed by URI (not version): after a successful version advance we
 * incremental-parse using the previous tree. On version reject the CST is left unchanged
 * because the buffer was not updated.
 *
 * This matches LSP semantics: `TextDocuments` is the source of truth for buffer text;
 * this registry adds version guards and optional CST sidecar storage.
 */
export type VersionSyncResult =
  | { ok: true; document: TextDocument }
  | { ok: false; reason: "unknown-uri" | "stale-version" | "version-gap" };

export class DocumentRegistry {
  /** URI → LSP text buffer. */
  private readonly buffers = new Map<string, TextDocument>();
  /** URI → last accepted LSP document version. */
  private readonly versions = new Map<string, number>();
  /** URI → incremental tree-sitter CST (optional sidecar). */
  private readonly trees = new Map<string, ParseTree>();

  /** Document opened (full text). */
  trackOpen(document: TextDocument): VersionSyncResult {
    const prev = this.versions.get(document.uri);
    if (prev !== undefined && document.version <= prev) {
      return { ok: false, reason: "stale-version" };
    }
    this.buffers.set(document.uri, document);
    this.versions.set(document.uri, document.version);
    return { ok: true, document };
  }

  /**
   * Apply incremental LSP edits. `nextVersion` must be strictly greater than the
   * stored version unless this is the first change after open with matching version.
   */
  trackChange(
    uri: string,
    contentChanges: TextDocumentContentChangeEvent[],
    nextVersion: number
  ): VersionSyncResult {
    const current = this.buffers.get(uri);
    if (!current) return { ok: false, reason: "unknown-uri" };

    const prevVersion = this.versions.get(uri);
    if (prevVersion === undefined) return { ok: false, reason: "unknown-uri" };
    if (nextVersion <= prevVersion) return { ok: false, reason: "stale-version" };
    if (nextVersion > prevVersion + 1) {
      return { ok: false, reason: "version-gap" };
    }

    const updated = TextDocumentImpl.update(current, contentChanges, nextVersion);
    this.buffers.set(uri, updated);
    this.versions.set(uri, nextVersion);
    return { ok: true, document: updated };
  }

  /** Sync from an already-updated document (e.g. `TextDocuments` manager event). */
  trackSyncedDocument(document: TextDocument): VersionSyncResult {
    const prev = this.versions.get(document.uri);
    if (prev === undefined) {
      return this.trackOpen(document);
    }
    if (document.version <= prev) {
      return { ok: false, reason: "stale-version" };
    }
    if (document.version > prev + 1) {
      return { ok: false, reason: "version-gap" };
    }
    this.buffers.set(document.uri, document);
    this.versions.set(document.uri, document.version);
    return { ok: true, document };
  }

  trackClose(uri: string): void {
    this.buffers.delete(uri);
    this.versions.delete(uri);
    this.trees.delete(uri);
  }

  getBuffer(uri: string): TextDocument | undefined {
    return this.buffers.get(uri);
  }

  getAcceptedVersion(uri: string): number | undefined {
    return this.versions.get(uri);
  }

  getTree(uri: string): ParseTree | undefined {
    return this.trees.get(uri);
  }

  setTree(uri: string, tree: ParseTree | undefined): void {
    if (tree === undefined) {
      this.trees.delete(uri);
    } else {
      this.trees.set(uri, tree);
    }
  }

  getConceptBaseDocument(uri: string): ConceptBaseDocument | undefined {
    const document = this.buffers.get(uri);
    if (!document) return undefined;
    return toConceptBaseDocument(document, this.trees.get(uri));
  }

  openCount(): number {
    return this.buffers.size;
  }

  /** All open ConceptBase buffers (for tests / diagnostics sweep). */
  entries(): ConceptBaseDocument[] {
    return [...this.buffers.entries()].map(([uri, document]) =>
      toConceptBaseDocument(document, this.trees.get(uri))
    );
  }
}
