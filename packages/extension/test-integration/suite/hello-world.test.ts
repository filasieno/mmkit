import * as assert from "node:assert";
import * as vscode from "vscode";
import { HELLO_WORLD_COMMAND, HELLO_WORLD_MESSAGE } from "@mmkit/shared";

suite("hello world integration", () => {
  test("extension activates and hello world command is registered", async () => {
    const ext = vscode.extensions.getExtension("conceptbase.mmkit");
    assert.ok(ext, "conceptbase.mmkit extension should be present");
    await ext.activate();

    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes(HELLO_WORLD_COMMAND), "hello world command should be registered");
  });

  test("hello world command shows the expected message", async () => {
    const original = vscode.window.showInformationMessage;
    const shown: string[] = [];

    try {
      vscode.window.showInformationMessage = async (message: string) => {
        shown.push(message);
        return message;
      };

      await vscode.commands.executeCommand(HELLO_WORLD_COMMAND);
      assert.deepStrictEqual(shown, [HELLO_WORLD_MESSAGE]);
    } finally {
      vscode.window.showInformationMessage = original;
    }
  });
});
