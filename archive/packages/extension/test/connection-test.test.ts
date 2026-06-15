import { expect } from "chai";
import { runConnectionTest } from "../src/commands/connection-test";
import { CONNECTION_TEST_ASK_QUERY, buildAskPayload, isExistsClassYes } from "../src/protocol/cb-ask";
import { encodeCbString } from "../src/protocol/cb-tcp";
import { createSimPorts } from "../src/ports/sim/sim-ports";
import { MmkitTraceWriter } from "../src/logging/trace";

describe("connection test", () => {
  it("buildAskPayload encodes query and rollback time", () => {
    const payload = buildAskPayload(CONNECTION_TEST_ASK_QUERY);
    expect(payload).to.equal(
      `OBJNAMES,${encodeCbString(CONNECTION_TEST_ASK_QUERY)},${encodeCbString("LABEL")},${encodeCbString("Now")}`
    );
  });

  it("isExistsClassYes accepts yes replies", () => {
    expect(isExistsClassYes("yes")).to.equal(true);
    expect(isExistsClassYes('"yes"')).to.equal(true);
    expect(isExistsClassYes("no")).to.equal(false);
  });

  it("runConnectionTest succeeds against sim TCP with builtin exists query", async () => {
    const ports = createSimPorts();
    const result = await runConnectionTest({
      ports,
      host: "127.0.0.1",
      port: 4001,
      toolName: "mmkit-test",
      userName: "user",
      connectTimeoutMs: 1000,
      trace: new MmkitTraceWriter("connection.test"),
    });
    expect(result.ok).to.equal(true);
    expect(result.query).to.equal(CONNECTION_TEST_ASK_QUERY);
    expect(result.reply).to.equal("yes");
  });

  it("runConnectionTest reports connect failure", async () => {
    const ports = createSimPorts();
    ports.sim.tcp.failConnect = true;
    const result = await runConnectionTest({
      ports,
      host: "127.0.0.1",
      port: 4001,
      toolName: "mmkit-test",
      userName: "user",
      connectTimeoutMs: 1000,
    });
    expect(result.ok).to.equal(false);
    expect(result.error).to.include("connect");
  });
});
