import { expect } from "chai";
import { buildIpcMessage, encodeCbString, parseAnswerTerm } from "@mmkit/shared";
import { MCP_CB_TOOL_NAMES } from "../src/mcp/mcp-tool-names";

describe("MCP server", () => {
  it("registers full ICBclient tool surface", () => {
    expect(MCP_CB_TOOL_NAMES).to.include("cb_connect");
    expect(MCP_CB_TOOL_NAMES).to.include("cb_tell");
    expect(MCP_CB_TOOL_NAMES).to.include("cb_ask");
    expect(MCP_CB_TOOL_NAMES).to.include("cb_lpi_call");
    expect(MCP_CB_TOOL_NAMES).to.include("cb_stop_server");
    expect(MCP_CB_TOOL_NAMES.length).to.be.greaterThan(20);
  });

  it("builds ipc messages compatible with libcbc framing", () => {
    const msg = buildIpcMessage('"tool"', '"cbserver"', "ASK", 'OBJNAMES,"exists[Class/objname]","LABEL","Now"');
    expect(msg).to.include("ipcmessage");
    const parsed = parseAnswerTerm('ipcmessage("cbserver",ok,"mmkit").');
    expect(parsed.completion).to.equal("ok");
    expect(parsed.returnData).to.equal("mmkit");
  });

  it("encodes CB strings like Java CButil.encodeString", () => {
    expect(encodeCbString('say "hi"')).to.equal('"say \\"hi\\""');
  });
});
