import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { expect } from "chai";
import { isInstallationComplete, materializeInstallAssets } from "../src/install/materialize";
import { resolveServerPaths } from "../src/config/paths";
import { DEFAULT_SERVER } from "../src/config/schema";

describe("install materialize", () => {
  it("copies bundled workspace assets and writes install marker", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "mmkit-install-"));
    const assetRoot = path.join(__dirname, "..", "..", "assets", "cbserver");
    const paths = resolveServerPaths({ ...DEFAULT_SERVER, dataDir: root });

    expect(await isInstallationComplete(paths)).to.equal(false);
    await materializeInstallAssets(assetRoot, paths);
    expect(await isInstallationComplete(paths)).to.equal(true);

    const readme = await fs.readFile(path.join(paths.databaseAllPath, "README.md"), "utf8");
    expect(readme).to.include("mmkit cbserver workspace");
  });
});
