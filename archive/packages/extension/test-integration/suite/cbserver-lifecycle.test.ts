import * as assert from "node:assert";
import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";
import { getTestApi, waitForLanguageClientRunning } from "../helpers/mmkit-api";

const HAS_CBSERVER = Boolean(process.env.MMKIT_CBSERVER_BIN);

async function waitForConfigDataDir(api: Awaited<ReturnType<typeof getTestApi>>, dataDir: string): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (api.getConfigDataDir?.() === dataDir) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.fail(`timed out waiting for config snapshot dataDir=${dataDir}, got ${api.getConfigDataDir?.()}`);
}

async function waitForConfigValue(key: string, expected: unknown, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const config = vscode.workspace.getConfiguration("mmkit");
    if (config.get(key) === expected) {
      await new Promise((r) => setTimeout(r, 500));
      return;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.fail(`timed out waiting for mmkit.${key}=${String(expected)}`);
}

async function waitForServerState(
  api: Awaited<ReturnType<typeof getTestApi>>,
  target: string,
  timeoutMs = 240_000
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (api.getMmkitServerPanelState() === target) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  assert.fail(`timed out waiting for mmkit server state ${target}, got ${api.getMmkitServerPanelState()}`);
}

suite("mmkit cbserver lifecycle", function () {
  this.timeout(300_000);

  (HAS_CBSERVER ? test : test.skip)("startServer and stopServer complete without fatal errors", async () => {
    const config = vscode.workspace.getConfiguration("mmkit");
    await config.update("operationalMode", "internalServer", vscode.ConfigurationTarget.Global);
    await config.update("server.launchKind", "executable", vscode.ConfigurationTarget.Global);
    await config.update("server.autoStartup", false, vscode.ConfigurationTarget.Global);
    const dataDir = path.join(os.tmpdir(), `mmkit-cbserver-test-${process.pid}`);
    const serverPort = 14000 + (process.pid % 1000);
    if (process.env.MMKIT_CBSERVER_BIN) {
      await config.update("server.executablePath", process.env.MMKIT_CBSERVER_BIN, vscode.ConfigurationTarget.Global);
    }
    await config.update("server.dataDir", dataDir, vscode.ConfigurationTarget.Global);
    await config.update("server.port", serverPort, vscode.ConfigurationTarget.Global);
    await waitForConfigValue("server.dataDir", dataDir);

    const api = await getTestApi();
    await waitForLanguageClientRunning(api);
    await waitForConfigDataDir(api, dataDir);

    assert.strictEqual(api.getActorState("language.server"), "Running");
    assert.notStrictEqual(api.getSupervisorState(), "FatalErrorState");

    await vscode.commands.executeCommand("mmkit.startServer");
    await waitForServerState(api, "Starting", 15_000).catch(() => undefined);
    await waitForServerState(api, "Running");

    const connected = await api.runConnectionTest();
    assert.strictEqual(connected.ok, true, connected.message);

    await vscode.commands.executeCommand("mmkit.stopServer");
    await waitForServerState(api, "Idle");

    assert.notStrictEqual(api.getSupervisorState(), "FatalErrorState");
    assert.notStrictEqual(api.getActorState("language.server"), "FatalErrorState");
  });
});
