/**
 * Real cbserver — STOP_SERVER only (command steps run via commands-steps.real.test.ts).
 */
/// <reference types="mocha" />
import { expect } from "chai";
import type { RunningServer } from "./realHarness";
import { describeReal, installRealTestGuards, PER_TEST_TIMEOUT_MS, raceTimeout, waitForEmptyRegistry, waitForServerState, withRealServer, MS, openConnection, } from "./realHarness";
import { cbTraceAnswer } from "../../src/cbserver/shared/cbTrace";

async function runStopServerCmd(server: RunningServer): Promise<void> {
  const connection = await openConnection(server);
  const answerP = raceTimeout(connection.stopServer(""), "stopServer", MS.cmd);
  const stoppedP = waitForServerState(server, "Stopped", "stop-after-stop-server", MS.stop);
  const [answerResult, stoppedResult] = await raceTimeout( Promise.allSettled([answerP, stoppedP]), "stop-server-settle", MS.teardown );
  expect(stoppedResult.status, "server must reach Stopped").to.equal("fulfilled");
  if (answerResult.status === "fulfilled") {
    cbTraceAnswer("test:cmd:done:stopServer", answerResult.value);
    expect(answerResult.value.ok, `stopServer completion=${answerResult.value.completion}`).to.equal(true);
  }
  // Manual § STOP_SERVER: server terminates the session; sockets may end before the promise settles.
  await waitForEmptyRegistry(server, "stopServer-registry");
}

async function stopServerTest(this: Mocha.Context): Promise<void> {
  await withRealServer("stop-server-cmd", runStopServerCmd);
}

function stopServerDescribe(this: Mocha.Suite): void {
  this.timeout(PER_TEST_TIMEOUT_MS);
  installRealTestGuards(this);
  it("STOP_SERVER returns ok (manual: same effect as CANCEL_ME for this client)", stopServerTest);
}

describeReal("CBServer STOP_SERVER [real cbserver]", stopServerDescribe);
