import * as vscode from "vscode";
import type { PanelInteraction, PanelViewModel } from "../types";
import type { PanelPortBridge } from "../ports/real/panel-port";

const VIEW_TYPE = "mmkit.panel";

export class MmkitPanelProvider implements vscode.WebviewViewProvider, PanelPortBridge {
  private view?: vscode.WebviewView;
  private interactionHandler?: (interaction: PanelInteraction) => void;

  constructor(private readonly extensionUri: vscode.Uri) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, "out", "panel-webview")],
    };
    webviewView.webview.html = this.buildHtml(webviewView.webview);
    webviewView.webview.onDidReceiveMessage((message: { type?: string; payload?: PanelInteraction }) => {
      if (message?.type === "webviewReady") {
        this.flushPendingViewModel(webviewView);
        return;
      }
      if (message?.type === "interaction" && message.payload && this.interactionHandler) {
        this.interactionHandler(message.payload);
      }
    });
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        this.flushPendingViewModel(webviewView);
      }
    });
  }

  private pendingViewModel?: PanelViewModel;

  postViewModel(viewModel: PanelViewModel): void {
    this.pendingViewModel = viewModel;
    if (!this.view?.visible) return;
    this.flushPendingViewModel(this.view);
  }

  private flushPendingViewModel(webviewView: vscode.WebviewView): void {
    if (!this.pendingViewModel) return;
    void webviewView.webview.postMessage({ type: "viewModel", payload: this.pendingViewModel });
  }

  onInteraction(handler: (interaction: PanelInteraction) => void): () => void {
    this.interactionHandler = handler;
    return () => {
      if (this.interactionHandler === handler) this.interactionHandler = undefined;
    };
  }

  isVisible(): boolean {
    return this.view?.visible ?? false;
  }

  private buildHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "out", "panel-webview", "main.js"));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "out", "panel-webview", "main.css"));
    const csp = [
      "default-src 'none'",
      `style-src ${webview.cspSource}`,
      `script-src ${webview.cspSource}`,
    ].join("; ");
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="${styleUri}" />
</head>
<body>
  <div id="root"></div>
  <script src="${scriptUri}"></script>
</body>
</html>`;
  }
}

export function registerMmkitPanelProvider(context: vscode.ExtensionContext): MmkitPanelProvider {
  const provider = new MmkitPanelProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(VIEW_TYPE, provider, { webviewOptions: { retainContextWhenHidden: true } })
  );
  return provider;
}

export { VIEW_TYPE as MMKIT_PANEL_VIEW_TYPE };
