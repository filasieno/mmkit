/**
 * Mock ports — STOP_SERVER (command steps run via commands-steps.mock.test.ts).
 */
/// <reference types="mocha" />
import { expect } from "chai";
import type { RunningServer } from "./harnessTypes";
import {
  installMockTestGuards,
  MS,
  openConnection,
  PER_TEST_TIMEOUT_MS,
  raceTimeout,
  waitForEmptyRegistry,
  waitForServerState,
  withMockServer,
} from "./mockHarness";
import { cbTraceAnswer } from "../../src/cbserver/shared/cbTrace";
import { waitCommand } from "../../src/cbserver/shared/CBServerDefs";

async function runStopServerCmd(server: RunningServer): Promise<void> {
  const connection = await openConnection(server);
  const answerP = raceTimeout(waitCommand(connection.call.stopServer("")), "stopServer", MS.cmd);
  const stoppedP = waitForServerState(server, "Stopped", "stop-after-stop-server", MS.stop);
  const [answerResult, stoppedResult] = await raceTimeout(
    Promise.allSettled([answerP, stoppedP]),
    "stop-server-settle",
    MS.teardown,
  );
  expect(stoppedResult.status, "server must reach Stopped").to.equal("fulfilled");
  if (answerResult.status === "fulfilled") {
    cbTraceAnswer("test:cmd:done:stopServer", answerResult.value);
    expect(answerResult.value.ok, `stopServer completion=${answerResult.value.completion}`).to.equal(true);
  }
  await waitForEmptyRegistry(server, "stopServer-registry");
}

describe("CBServer STOP_SERVER [mock port]", function () {
  this.timeout(PER_TEST_TIMEOUT_MS);
  installMockTestGuards(this);

  it("STOP_SERVER returns ok (manual: same effect as CANCEL_ME for this client)", async function () {
    await withMockServer("stop-server-cmd", runStopServerCmd);
  });
});
