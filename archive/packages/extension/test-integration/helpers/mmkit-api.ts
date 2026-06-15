import * as assert from "node:assert";
import * as vscode from "vscode";
import { State } from "vscode-languageclient/node";
import type { MmkitTestApi } from "../../src/extension";

export async function getTestApi(): Promise<MmkitTestApi> {
  const ext = vscode.extensions.getExtension("conceptbase.mmkit");
  assert.ok(ext, "conceptbase.mmkit extension should be present");
  await ext.activate();
  const exportsApi = ext.exports as MmkitTestApi | undefined;
  if (exportsApi?.getLanguageClientState) return exportsApi;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("../../out/extension.js") as { getMmkitTestApi: () => MmkitTestApi };
  return mod.getMmkitTestApi();
}

export async function waitForLanguageClientRunning(
  api: MmkitTestApi,
  timeoutMs = 90_000
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const state = api.getLanguageClientState();
    if (state === State.Running) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.fail(
    `timed out waiting for ConceptBase LSP Running, got state=${String(api.getLanguageClientState())}`
  );
}

/** Wait until the language server publishes diagnostics for `uri` (including an empty set). */
export async function waitForLspDiagnosticPublish(uri: vscode.Uri, timeoutMs = 60_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      disposable.dispose();
      reject(new Error(`timed out waiting for LSP diagnostic publish on ${uri.fsPath}`));
    }, timeoutMs);

    const disposable = vscode.languages.onDidChangeDiagnostics((event) => {
      if (event.uris.some((u) => u.toString() === uri.toString())) {
        clearTimeout(timer);
        disposable.dispose();
        resolve();
      }
    });
  });
}

export async function openConceptBaseDocument(
  uri: vscode.Uri,
  options?: { waitForPublish?: boolean; forceLspSync?: boolean }
): Promise<vscode.TextEditor> {
  if (options?.forceLspSync) {
    await closeAllEditors();
  }
  const waitForPublish = options?.waitForPublish ?? true;
  const alreadyOpen =
    !options?.forceLspSync &&
    vscode.workspace.textDocuments.some((d) => d.uri.toString() === uri.toString());
  const publish = waitForPublish && !alreadyOpen ? waitForLspDiagnosticPublish(uri) : undefined;
  const doc = await vscode.workspace.openTextDocument(uri);
  assert.strictEqual(doc.languageId, "conceptbase");
  const editor = await vscode.window.showTextDocument(doc);
  if (publish) await publish;
  return editor;
}

export async function closeAllEditors(): Promise<void> {
  await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  await new Promise((r) => setTimeout(r, 100));
}

export async function waitForDiagnostics(
  uri: vscode.Uri,
  predicate: (diagnostics: readonly vscode.Diagnostic[]) => boolean,
  timeoutMs = 60_000
): Promise<readonly vscode.Diagnostic[]> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const diagnostics = vscode.languages.getDiagnostics(uri);
    if (predicate(diagnostics)) return diagnostics;
    await new Promise<void>((resolve) => {
      const remaining = Math.min(500, deadline - Date.now());
      if (remaining <= 0) {
        resolve();
        return;
      }
      const disposable = vscode.languages.onDidChangeDiagnostics((event) => {
        if (event.uris.some((u) => u.toString() === uri.toString())) {
          disposable.dispose();
          resolve();
        }
      });
      setTimeout(() => {
        disposable.dispose();
        resolve();
      }, remaining);
    });
  }
  const last = vscode.languages.getDiagnostics(uri);
  assert.fail(
    `timed out waiting for diagnostics on ${uri.fsPath} (last count=${last.length})`
  );
}
