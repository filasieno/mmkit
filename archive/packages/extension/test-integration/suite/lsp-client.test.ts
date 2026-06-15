import * as assert from "node:assert";
import * as path from "node:path";
import * as vscode from "vscode";
import { State } from "vscode-languageclient/node";
import {
  closeAllEditors,
  getTestApi,
  openConceptBaseDocument,
  waitForDiagnostics,
  waitForLanguageClientRunning,
  waitForLspDiagnosticPublish,
} from "../helpers/mmkit-api";

const LSP_DOCKER_E2E = process.env.MMKIT_LSP_DOCKER_E2E === "1";

function fixtureUri(ext: vscode.Extension<unknown>, ...parts: string[]): vscode.Uri {
  return vscode.Uri.file(path.join(ext.extensionPath, ...parts));
}

function errorDiagnostics(diags: readonly vscode.Diagnostic[]): vscode.Diagnostic[] {
  return diags.filter((d) => d.severity === vscode.DiagnosticSeverity.Error);
}

suite("mmkit ConceptBase LSP integration", function () {
  this.timeout(120_000);

  test("registers restartLanguageServer command", async () => {
    const ext = vscode.extensions.getExtension("conceptbase.mmkit");
    assert.ok(ext);
    await ext.activate();
    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes("mmkit.restartLanguageServer"));
  });

  test("language client reaches Running after extension activate", async () => {
    const api = await getTestApi();
    await waitForLanguageClientRunning(api);
    assert.strictEqual(api.getLanguageClientState(), State.Running);
  });

  test("opening a valid .cbs file connects to the language server", async () => {
    const api = await getTestApi();
    await waitForLanguageClientRunning(api);

    const ext = vscode.extensions.getExtension("conceptbase.mmkit");
    assert.ok(ext);
    const uri = fixtureUri(ext, "test", "fixtures", "sample.cbs");
    await openConceptBaseDocument(uri);

    const diags = vscode.languages.getDiagnostics(uri);
    assert.strictEqual(
      errorDiagnostics(diags).length,
      0,
      `valid sample should have no error diagnostics: ${JSON.stringify(diags)}`
    );
  });

  test("broken .cbs receives syntax error diagnostics from the language server", async () => {
    const api = await getTestApi();
    await waitForLanguageClientRunning(api);

    const ext = vscode.extensions.getExtension("conceptbase.mmkit");
    assert.ok(ext);
    const uri = fixtureUri(ext, "test-integration", "fixtures", "broken.cbs");
    await openConceptBaseDocument(uri);

    const diags = await waitForDiagnostics(
      uri,
      (items) => errorDiagnostics(items).length > 0,
      60_000
    );
    assert.ok(errorDiagnostics(diags).length > 0, "expected syntax error diagnostics");
  });

  test("incremental edit triggers refreshed diagnostics", async () => {
    const api = await getTestApi();
    await waitForLanguageClientRunning(api);

    const ext = vscode.extensions.getExtension("conceptbase.mmkit");
    assert.ok(ext);
    const uri = fixtureUri(ext, "test-integration", "fixtures", "broken.cbs");
    const editor = await openConceptBaseDocument(uri);

    const inserted = await editor.edit((builder) => {
      builder.insert(new vscode.Position(0, 0), "extra\n");
    });
    assert.ok(inserted, "edit should apply");

    const diags = await waitForDiagnostics(
      editor.document.uri,
      (items) => errorDiagnostics(items).length > 0,
      60_000
    );
    assert.ok(errorDiagnostics(diags).length > 0, "expected errors after editing broken buffer");
  });

  test("restartLanguageServer recovers and keeps serving open buffers", async () => {
    const api = await getTestApi();
    await waitForLanguageClientRunning(api);

    const ext = vscode.extensions.getExtension("conceptbase.mmkit");
    assert.ok(ext);
    const uri = fixtureUri(ext, "test", "fixtures", "sample.cbs");

    await vscode.commands.executeCommand("mmkit.restartLanguageServer");
    await waitForLanguageClientRunning(api, 90_000);

    await closeAllEditors();
    const doc = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(doc);

    const publish = waitForLspDiagnosticPublish(uri);
    const nudged = await editor.edit((builder) => {
      builder.insert(new vscode.Position(1, 0), " ");
    });
    assert.ok(nudged, "edit nudge should apply");
    await editor.edit((builder) => {
      builder.delete(new vscode.Range(1, 0, 1, 1));
    });
    await publish;

    const diags = vscode.languages.getDiagnostics(uri);
    assert.strictEqual(
      errorDiagnostics(diags).length,
      0,
      `expected no errors after restart: ${JSON.stringify(diags)}`
    );
  });

  (LSP_DOCKER_E2E ? test : test.skip)(
    "docker compose launch connects over TCP when configured",
    async function () {
      this.timeout(300_000);
      const ext = vscode.extensions.getExtension("conceptbase.mmkit");
      assert.ok(ext);
      await ext.activate();

      const config = vscode.workspace.getConfiguration("mmkit");
      await config.update("languageServer.launchKind", "dockerCompose", vscode.ConfigurationTarget.Global);
      await config.update(
        "languageServer.dockerCompose.httpPort",
        Number(process.env.MMKIT_HTTP_PORT ?? "28080"),
        vscode.ConfigurationTarget.Global
      );
      await config.update(
        "languageServer.dockerCompose.lspPort",
        Number(process.env.MMKIT_LSP_PORT ?? "16011"),
        vscode.ConfigurationTarget.Global
      );
      await config.update(
        "languageServer.dockerCompose.grafanaPort",
        Number(process.env.MMKIT_GRAFANA_PORT ?? "3001"),
        vscode.ConfigurationTarget.Global
      );

      await vscode.commands.executeCommand("mmkit.restartLanguageServer");

      const api = await getTestApi();
      await waitForLanguageClientRunning(api, 180_000);

      const uri = fixtureUri(ext, "test", "fixtures", "sample.cbs");
      await openConceptBaseDocument(uri);
      assert.strictEqual(errorDiagnostics(vscode.languages.getDiagnostics(uri)).length, 0);
    }
  );
});
