import { expect } from "chai";
import {
  SUPERVISOR_PLUGIN_ID,
  LANGUAGE_TOOLING_PLUGIN_ID,
  MMKIT_PLUGIN_ACTIVATION_ORDER,
  MMKIT_PLUGIN_IDS,
  MMKIT_SINGLE_EXTENSION_MANIFEST,
  NODE_EDITOR_PLUGIN_ID,
  PANEL_PLUGIN_ID,
  TRACE_PLUGIN_ID,
} from "../src/plugins/manifest";

describe("mmkit single-extension app plugins", () => {
  it("registers all feature plugins in activation order", () => {
    expect(MMKIT_PLUGIN_ACTIVATION_ORDER).to.deep.equal([
      TRACE_PLUGIN_ID,
      SUPERVISOR_PLUGIN_ID,
      PANEL_PLUGIN_ID,
      NODE_EDITOR_PLUGIN_ID,
      LANGUAGE_TOOLING_PLUGIN_ID,
    ]);
  });

  it("exports stable plugin id list", () => {
    expect(MMKIT_PLUGIN_IDS).to.deep.equal([
      "mmkit.trace",
      "mmkit.supervisor",
      "mmkit.panel",
      "mmkit.node-editor",
      "mmkit.language-tooling",
    ]);
  });

  it("manifest covers cbserver, LSP, panel, node editor, and commands in one extension", () => {
    const ids = MMKIT_SINGLE_EXTENSION_MANIFEST.map((e) => e.id);
    expect(ids).to.deep.equal([...MMKIT_PLUGIN_IDS]);
    const features = MMKIT_SINGLE_EXTENSION_MANIFEST.flatMap((e) => e.features).join(" ");
    expect(features).to.contain("LSP");
    expect(features).to.contain("cbserver");
    expect(features).to.contain("command palette");
    expect(features).to.contain("notebook");
    expect(features).to.contain("WebGL2");
  });

  it("has exactly five app plugins in the single VSIX", () => {
    expect(MMKIT_SINGLE_EXTENSION_MANIFEST).to.have.length(5);
  });
});
