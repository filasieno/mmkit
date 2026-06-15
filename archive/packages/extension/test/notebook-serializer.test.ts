import { expect } from "chai";
import { MMNB_VERSION } from "@mmkit/shared";
import { parseMmnbBytes, serializeMmnbCells } from "../src/notebook/mmnb-format";

describe("MM notebook format", () => {
  it("round-trips ConceptBase code cells", () => {
    const source = {
      mmkitVersion: MMNB_VERSION,
      cells: [{ id: "cell-1", value: 'frame\n  in\n    name / "Example";\n  end' }],
    };
    const bytes = Buffer.from(JSON.stringify(source), "utf8");
    const data = parseMmnbBytes(bytes);
    expect(data.cells).to.have.length(1);
    const out = serializeMmnbCells([
      { kind: "code", value: data.cells[0].value, metadata: { mmkitCellId: data.cells[0].id } },
    ]);
    const parsed = JSON.parse(Buffer.from(out).toString("utf8")) as typeof source;
    expect(parsed.mmkitVersion).to.equal(MMNB_VERSION);
    expect(parsed.cells[0].value).to.equal(source.cells[0].value);
    expect(parsed.cells[0].id).to.equal("cell-1");
  });

  it("rejects non-code cell shapes", () => {
    const bad = { mmkitVersion: MMNB_VERSION, cells: [{ id: "x", value: 1 }] };
    const bytes = Buffer.from(JSON.stringify(bad), "utf8");
    expect(() => parseMmnbBytes(bytes)).to.throw(/only code cells/);
  });
});
