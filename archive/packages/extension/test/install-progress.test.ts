import { expect } from "chai";
import * as path from "node:path";
import { buildSnapshot } from "../src/config/snapshot";
import { DEFAULT_RAW } from "../src/config/schema";
import { percentWithinStep } from "../src/install/progress";
import { materializeInstallAssets } from "../src/install/materialize";

describe("install progress", () => {
  it("maps step fractions to overall percent ranges", () => {
    expect(percentWithinStep("prepare", 0)).to.equal(0);
    expect(percentWithinStep("prepare", 1)).to.equal(15);
    expect(percentWithinStep("materialize", 0)).to.equal(15);
    expect(percentWithinStep("awaitPort", 1)).to.equal(99);
  });

  it("emits multiple materialize progress callbacks", async () => {
    const assetRoot = path.join(__dirname, "..", "..", "assets", "cbserver");
    const snapshot = buildSnapshot(DEFAULT_RAW, 1);
    const messages: string[] = [];
    await materializeInstallAssets(assetRoot, snapshot.paths, (message) => {
      messages.push(message);
    });
    expect(messages.length).to.be.greaterThan(4);
    expect(messages[0]).to.include("manifest");
    expect(messages.at(-1)).to.include("installed");
  });
});
