import { NODE_EDITOR_VIEW_TYPE } from "@mmkit/shared";
import * as vscode from "vscode";
import { parseVirtualNodeDocument } from "./virtual-document";

const WEBVIEW_ROOT = "out/node-editor-webview";

type NodeEditorCustomDocument = vscode.CustomDocument;

export class NodeEditorProvider implements vscode.CustomReadonlyEditorProvider<NodeEditorCustomDocument> {
  constructor(private readonly extensionUri: vscode.Uri) {}

  openCustomDocument(
    uri: vscode.Uri,
    _openContext: vscode.CustomDocumentOpenContext,
    _token: vscode.CancellationToken
  ): NodeEditorCustomDocument {
    return { uri, dispose() {} };
  }

  async resolveCustomEditor(
    document: NodeEditorCustomDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    const textDoc = await vscode.workspace.openTextDocument(document.uri);
    const parsed = parseVirtualNodeDocument(document.uri, textDoc.getText());

    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, WEBVIEW_ROOT),
        vscode.Uri.joinPath(this.extensionUri, WEBVIEW_ROOT, "assets"),
      ],
    };
    webviewPanel.webview.html = this.buildHtml(webviewPanel.webview, parsed.title);
    webviewPanel.title = parsed.title;
  }

  private buildHtml(webview: vscode.Webview, title: string): string {
    const asset = (name: string) =>
      webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, WEBVIEW_ROOT, name));
    const scriptUri = asset("main.js");
    const styleUri = asset("main.css");
    const hbWasmUri = asset("hb.wasm");
    const fontUri = asset("Inter-Regular.woff");
    const nonce = String(Date.now());
    const csp = [
      "default-src 'none'",
      `style-src ${webview.cspSource}`,
      `script-src 'nonce-${nonce}' ${webview.cspSource}`,
      `font-src ${webview.cspSource}`,
    ].join("; ");

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="${styleUri}" />
  <title>${title}</title>
</head>
<body>
  <header class="toolbar">
    <span class="title">${title}</span>
    <span class="credit">Slug GPU text — Eric Lengyel (public domain)</span>
  </header>
  <canvas id="canvas"></canvas>
  <footer class="footer">
    <div id="status" class="status" role="status"></div>
    <div id="fps" class="fps" aria-live="polite">— fps</div>
  </footer>
  <script nonce="${nonce}">
    window.__MMKIT_NODE_EDITOR__ = {
      hbWasm: ${JSON.stringify(hbWasmUri.toString())},
      font: ${JSON.stringify(fontUri.toString())},
      greeting: "Hello World"
    };
  </script>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

export function registerNodeEditorProvider(context: vscode.ExtensionContext): vscode.Disposable {
  const provider = new NodeEditorProvider(context.extensionUri);
  return vscode.window.registerCustomEditorProvider(NODE_EDITOR_VIEW_TYPE, provider, {
    webviewOptions: { retainContextWhenHidden: true },
    supportsMultipleEditorsPerDocument: false,
  });
}
