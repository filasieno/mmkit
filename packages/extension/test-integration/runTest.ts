import * as os from "node:os";
import * as path from "node:path";
import { runTests } from "@vscode/test-electron";

async function main(): Promise<void> {
  if (process.env.MMKIT_SKIP_INTEGRATION === "1") {
    console.log("MMKIT_SKIP_INTEGRATION=1 — skipping VS Code integration tests");
    return;
  }

  const extensionDevelopmentPath = path.resolve(__dirname, "..");
  const extensionTestsPath = path.resolve(__dirname, "..", "out-test-integration", "test-integration", "suite", "index.js");
  const userDataDir = path.join(os.tmpdir(), `mmkit-vscode-test-${process.pid}`);

  await runTests({
    extensionDevelopmentPath,
    extensionTestsPath,
    launchArgs: [
      "--disable-extensions",
      "--disable-workspace-trust",
      `--user-data-dir=${userDataDir}`,
    ],
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
