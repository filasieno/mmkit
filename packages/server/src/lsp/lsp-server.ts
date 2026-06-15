import { createServer } from "node:net";
import type { Server as NetServer } from "node:net";
import { createConnection, ProposedFeatures, StreamMessageReader, StreamMessageWriter, TextDocuments, } from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";

export function startLspTcp(port: number, onReady?: () => void): NetServer {
  const documents = new TextDocuments(TextDocument);

  const netServer = createServer( (socket) => { const connection = createConnection(ProposedFeatures.all, new StreamMessageReader(socket), new StreamMessageWriter(socket)); connection.onInitialize(() => ({ capabilities: { textDocumentSync: 1, }, })); documents.listen(connection); connection.listen(); } );

  netServer.listen(port, "0.0.0.0", onReady);
  return netServer;
}
