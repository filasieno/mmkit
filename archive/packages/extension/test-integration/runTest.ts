import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { runTests } from "@vscode/test-electron";

function resolveCbserverBin(): string | undefined {
  if (process.env.MMKIT_CBSERVER_BIN && fs.existsSync(process.env.MMKIT_CBSERVER_BIN)) {
    return process.env.MMKIT_CBSERVER_BIN;
  }
  const flakeRoot = path.resolve(__dirname, "../../../../..");
  try {
    const storePath = execSync("nix build .#cbserver --no-link --print-out-paths", {
      cwd: flakeRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
      .trim()
      .split("\n")[0];
    const bin = path.join(storePath, "bin/cbserver");
    return fs.existsSync(bin) ? bin : undefined;
  } catch {
    return undefined;
  }
}

async function main(): Promise<void> {
  if (process.env.MMKIT_SKIP_INTEGRATION === "1") {
    console.log("MMKIT_SKIP_INTEGRATION=1 — skipping VS Code integration tests");
    return;
  }

  const extensionDevelopmentPath = path.resolve(__dirname, "..");
  const extensionTestsPath = path.resolve(
    __dirname,
    "..",
    "out-test-integration",
    "test-integration",
    "suite",
    "index.js"
  );

  const cbserverBin = resolveCbserverBin();
  if (cbserverBin) {
    console.log(`Using cbserver binary: ${cbserverBin}`);
  } else {
    console.warn("No cbserver binary found — set MMKIT_CBSERVER_BIN or build with nix build .#cbserver");
  }

  const userDataDir = path.join(os.tmpdir(), `mmkit-vscode-test-${process.pid}`);

  await runTests({
    extensionDevelopmentPath,
    extensionTestsPath,
    launchArgs: [
      "--disable-extensions",
      "--disable-workspace-trust",
      "--enable-proposed-api=conceptbase.mmkit",
      `--user-data-dir=${userDataDir}`,
    ],
    extensionTestsEnv: {
      ...process.env,
      ...(cbserverBin
        ? {
            MMKIT_CBSERVER_BIN: cbserverBin,
            MMKIT_PORT_PROBE_ATTEMPTS: "240",
            MMKIT_PORT_PROBE_INTERVAL_MS: "250",
          }
        : {}),
    },
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
