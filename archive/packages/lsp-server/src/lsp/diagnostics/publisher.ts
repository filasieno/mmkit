import type { Diagnostic, Connection } from "vscode-languageserver/node";
import type { DocumentRegistry } from "../document-registry";
import { validateDocument } from "../parse";

export type SendDiagnosticsFn = (params: { uri: string; diagnostics: Diagnostic[] }) => void;

/**
 * Wires parse diagnostics to the LSP client (VS Code Problems panel).
 *
 * The extension host receives `textDocument/publishDiagnostics` and renders squiggles
 * in editors and the Diagnostics panel.
 */
export class DiagnosticsPublisher {
  constructor(private readonly send: SendDiagnosticsFn) {}

  static fromConnection(connection: Pick<Connection, "sendDiagnostics">): DiagnosticsPublisher {
    return new DiagnosticsPublisher((params) => connection.sendDiagnostics(params));
  }

  /** Parse + publish diagnostics for `uri`; returns the published set. */
  async publish(registry: DocumentRegistry, uri: string): Promise<Diagnostic[]> {
    const diagnostics = await validateDocument(registry, uri);
    this.send({ uri, diagnostics });
    return diagnostics;
  }

  /** Clear diagnostics when a document closes. */
  clear(uri: string): void {
    this.send({ uri, diagnostics: [] });
  }
}
