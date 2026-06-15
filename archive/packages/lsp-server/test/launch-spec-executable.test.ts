import { expect } from "chai";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { buildLaunchSpec } from "../src/cbserver/mmkit-server/launch-spec";
import { testSnapshot } from "./helpers/test-snapshot";

describe("launch-spec executable", () => {
  it("prefers installed cbserver under dataDir/bin", async () => {
    const savedBin = process.env.MMKIT_CBSERVER_BIN;
    delete process.env.MMKIT_CBSERVER_BIN;
    try {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "mmkit-launch-"));
    const dataDir = path.join(root, "data");
    const binDir = path.join(dataDir, "bin");
    await fs.mkdir(binDir, { recursive: true });
    const binary = path.join(binDir, "cbserver");
    await fs.writeFile(binary, "#!/bin/sh\n", "utf8");
    await fs.chmod(binary, 0o755);

    const snapshot = testSnapshot({ launchKind: "executable", executablePath: "" });
    snapshot.paths.dataDir = dataDir;
    snapshot.paths.databaseAllPath = path.join(dataDir, "workspace");
    snapshot.paths.tmpDir = path.join(dataDir, "tmp");
    snapshot.paths.loadDir = path.join(dataDir, "load");

    const spec = buildLaunchSpec(snapshot);
    expect(spec.kind).to.equal("executable");
    expect(spec.command).to.equal(binary);
    } finally {
      if (savedBin !== undefined) {
        process.env.MMKIT_CBSERVER_BIN = savedBin;
      }
    }
  });
});
