import { expect } from "chai";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { CBSERVER_INSTALL_REL_PATH } from "@mmkit/shared";
import { materializeInstallAssets } from "../src/cbserver/mmkit-server/install/materialize";

describe("materialize executable", () => {
  it("copies cbserver binary into dataDir/bin", async () => {
    const savedBin = process.env.MMKIT_CBSERVER_BIN;
    delete process.env.MMKIT_CBSERVER_BIN;
    try {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "mmkit-mat-"));
    const assetRoot = path.join(root, "assets");
    const dataDir = path.join(root, "data");
    await fs.mkdir(assetRoot, { recursive: true });
    await fs.mkdir(path.join(assetRoot, "workspace"), { recursive: true });
    await fs.mkdir(path.join(assetRoot, "load"), { recursive: true });
    await fs.writeFile(path.join(assetRoot, "workspace", "README.md"), "# test\n", "utf8");
    await fs.writeFile(path.join(assetRoot, "cbserver"), "#!/bin/sh\necho cbserver\n", "utf8");
    await fs.chmod(path.join(assetRoot, "cbserver"), 0o755);
    await fs.writeFile(
      path.join(assetRoot, "manifest.json"),
      JSON.stringify({
        version: 2,
        markerFile: ".mmkit-installed",
        directories: ["workspace", "tmp", "load", "bin"],
        workspaceFiles: ["README.md"],
        executable: { bundleName: "cbserver", installRelPath: CBSERVER_INSTALL_REL_PATH },
      }),
      "utf8"
    );

    const paths = {
      dataDir,
      databaseAllPath: path.join(dataDir, "workspace"),
      tmpDir: path.join(dataDir, "tmp"),
      loadDir: path.join(dataDir, "load"),
      databasePath: "",
      newDatabasePath: "",
      saveDir: "",
      viewsDir: "",
      installMarker: path.join(dataDir, ".mmkit-installed"),
    };

    await materializeInstallAssets(assetRoot, paths);
    const installed = path.join(dataDir, CBSERVER_INSTALL_REL_PATH);
    const stat = await fs.stat(installed);
    expect(stat.isFile()).to.equal(true);
    const content = await fs.readFile(installed, "utf8");
    expect(content).to.include("cbserver");
    } finally {
      if (savedBin !== undefined) {
        process.env.MMKIT_CBSERVER_BIN = savedBin;
      }
    }
  });
});
