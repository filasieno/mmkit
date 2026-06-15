import { expect } from "chai";
import { buildEnrollPayload, buildIpcMessage, lengthPrefix, parseAnswerTerm } from "../src/protocol/cb-tcp";

describe("cb-tcp protocol", () => {
  it("builds length-prefixed ipcmessage frame", () => {
    const msg = buildIpcMessage('""', '""', "ENROLL_ME", buildEnrollPayload("mmkit", "user"));
    const frame = lengthPrefix(msg);
    expect(frame[0]).to.equal("X".charCodeAt(0));
    expect(frame.length).to.equal(5 + Buffer.byteLength(msg));
  });

  it("parses ok answer term", () => {
    const parsed = parseAnswerTerm('ipcmessage("cbserver",ok,"mmkit").');
    expect(parsed.completion).to.equal("ok");
    expect(parsed.returnData).to.equal("mmkit");
  });
});
