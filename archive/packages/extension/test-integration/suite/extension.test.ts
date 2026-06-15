import * as assert from "node:assert";
import * as vscode from "vscode";
import { DEFAULT_RAW } from "../../src/config/schema";

suite("mmkit integration", () => {
  test("extension activates and default config targets internal executable server in ~/.mmkit", async () => {
    const ext = vscode.extensions.getExtension("conceptbase.mmkit");
    assert.ok(ext, "conceptbase.mmkit extension should be present");
    await ext.activate();

    const config = vscode.workspace.getConfiguration("mmkit");
    assert.strictEqual(config.get<string>("operationalMode"), DEFAULT_RAW.operationalMode);
    assert.strictEqual(config.get<string>("server.launchKind"), DEFAULT_RAW.server.launchKind);
    assert.strictEqual(config.get<boolean>("server.autoStartup"), DEFAULT_RAW.server.autoStartup);
    assert.strictEqual(config.get<string>("server.dataDir"), DEFAULT_RAW.server.dataDir);

    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes("mmkit.startServer"));
    assert.ok(commands.includes("mmkit.stopServer"));
    assert.ok(commands.includes("mmkit.connectionTest"));
  });
});
