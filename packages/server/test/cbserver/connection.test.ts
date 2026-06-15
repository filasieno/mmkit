/**
 * CBServerConnection — dual-channel orchestrator with mock TCP sockets.
 */
/// <reference types="mocha" />
import { expect } from "chai";
import * as ihsm from "ihsm/testing";
import { CBConnectionContext, waitForConnectionBootstrap, } from "../../src/cbserver/actors/connection/CBServerConnectionContext";
import { closeConnection } from "../../src/cbserver/actors/connection/connectionLifecycle";
import { CBConnectionTop } from "../../src/cbserver/actors/connection/CBServerConnectionConfig";
// Ensure state classes are registered (decorator side effects) even when this spec
// runs in isolation (no other spec imports these actor modules first).
import "../../src/cbserver/actors/connection/CBServerConnectionActor";
import "../../src/cbserver/actors/commandChannel/CBCommandChannelActor";
import "../../src/cbserver/actors/notificationChannel/CBNotificationChannelActor";
import "../../src/cbserver/actors/reader/CBConnectionReaderActor";
import "../../src/cbserver/actors/writer/CBConnectionWriterActor";
import { makeMockConnectionOrchestratorPort } from "./mockConnectionOrchestratorPort";
import { CB_IPC_METHODS } from "../../src/cbserver/shared/cbIpcCatalog";
import { formatTcpLengthFrame } from "../../src/cbserver/actors/reader/tcpFraming";
import { encodeCbString } from "@mmkit/base";
import { waitCommand } from "../../src/cbserver/shared/CBServerDefs";
import { assertMockCommandChannelCoverage, MOCK_COMMAND_CHANNEL_DISPATCH_CASES } from "./mockCommandCatalog";
import { makeMockChannelPair, type MockCBCommandChannelPort, type MockCBNotificationChannelPort } from "./mockTcpSocket";

describe("CBServerConnection [mock TCP socket]", function () {
  this.timeout(5_000);

  function makeConnectionContext(connectionId: string, onClose: () => void): CBConnectionContext {
    const pair = makeMockChannelPair("mock-cmd-client", "mock-notify-client");
    return new CBConnectionContext(connectionId, onClose, { host: "127.0.0.1", port: 4001 }, {
      command: pair.command,
      notification: pair.notification,
    });
  }

  it("auto-starts on spawn and enrolls both channels reaching ConnectionIdle", async () => {
    const closed: string[] = [];
    const ctx = makeConnectionContext("conn-1", () => closed.push("closed"));
    const bootstrap = waitForConnectionBootstrap(ctx);
    const actor = ihsm.makeTestActor(CBConnectionTop, ctx, makeMockConnectionOrchestratorPort());
    await actor.hsm.sync();
    await bootstrap;
    await actor.hsm.sync();
    expect(actor.hsm.currentStateName).to.equal("ConnectionIdle");
    expect(ctx.commandCtx?.enrolled).to.equal(true);
    expect(ctx.notificationCtx?.enrolled).to.equal(true);
  });

  it("pwd sends GET_MODULE_PATH via command channel", async () => {
    const ctx = makeConnectionContext("conn-2", () => undefined);
    const bootstrap = waitForConnectionBootstrap(ctx);
    const actor = ihsm.makeTestActor(CBConnectionTop, ctx, makeMockConnectionOrchestratorPort());
    await actor.hsm.sync();
    await bootstrap;
    await actor.hsm.sync();
    const answerP = waitCommand(actor.call.pwd());
    await actor.hsm.sync();
    const answer = await answerP;
    await actor.hsm.sync();
    expect(answer.ok).to.equal(true);
    const commandPort = ctx.channelPorts!.command! as ReturnType<typeof ihsm.makeTestPort<MockCBCommandChannelPort>>;
    expect(commandPort.write.calls.length).to.be.greaterThan(1);
  });

  it("close sends CANCEL_ME on both channels and reaches ConnectionClosed", async () => {
    const closed: string[] = [];
    const ctx = makeConnectionContext("conn-3", () => closed.push("closed"));
    const destroyOrder: string[] = [];
    const cmdPort = ctx.channelPorts!.command! as ReturnType<typeof ihsm.makeTestPort<MockCBCommandChannelPort>>;
    const notifPort = ctx.channelPorts!.notification! as ReturnType<typeof ihsm.makeTestPort<MockCBNotificationChannelPort>>;
    cmdPort.destroy.default(() => { destroyOrder.push("command"); });
    notifPort.destroy.default(() => { destroyOrder.push("notification"); });
    const bootstrap = waitForConnectionBootstrap(ctx);
    const actor = ihsm.makeTestActor(CBConnectionTop, ctx, makeMockConnectionOrchestratorPort());
    await actor.hsm.sync();
    await bootstrap;
    await actor.hsm.sync();
    const closeP = closeConnection(actor, ctx);
    await closeP;
    await actor.hsm.sync();
    expect(actor.hsm.currentStateName).to.equal("ConnectionClosed");
    expect(cmdPort.destroy.calls.length).to.equal(1);
    expect(notifPort.destroy.calls.length).to.equal(1);
    expect(destroyOrder).to.deep.equal(["command", "notification"]);
    expect(closed).to.deep.equal(["closed"]);
  });

  it("command channel socket error breaks connection with ConnectionBroken", async () => {
    const ctx = makeConnectionContext("conn-4", () => undefined);
    const bootstrap = waitForConnectionBootstrap(ctx);
    const actor = ihsm.makeTestActor(CBConnectionTop, ctx, makeMockConnectionOrchestratorPort());
    await actor.hsm.sync();
    await bootstrap;
    await actor.hsm.sync();
    const cmdPort = ctx.channelPorts!.command! as ReturnType<typeof ihsm.makeTestPort<MockCBCommandChannelPort>>;
    cmdPort.send("onSocketError", "ECONNRESET");
    await actor.hsm.sync();
    await actor.hsm.sync();
    expect(actor.hsm.currentStateName).to.equal("ConnectionBroken");
    expect(ctx.brokenReason).to.match(/ECONNRESET/);
  });

  it("reportClients uses REPORT_CLIENTS ipc method on command channel", async () => {
    const ctx = makeConnectionContext("conn-5", () => undefined);
    const bootstrap = waitForConnectionBootstrap(ctx);
    const actor = ihsm.makeTestActor(CBConnectionTop, ctx, makeMockConnectionOrchestratorPort());
    await actor.hsm.sync();
    await bootstrap;
    await actor.hsm.sync();
    const answerP = waitCommand(actor.call.reportClients());
    await actor.hsm.sync();
    const answer = await answerP;
    await actor.hsm.sync();
    expect(answer.ok).to.equal(true);
    const cmdPort = ctx.channelPorts!.command! as ReturnType<typeof ihsm.makeTestPort<MockCBCommandChannelPort>>;
    const writes = cmdPort.write.calls.map((c: [Buffer]) => c[0].toString("utf8"));
    expect(writes.some((w: string) => w.includes(CB_IPC_METHODS.REPORT_CLIENTS))).to.equal(true);
  });

  it("dispatches every command IPC via the command channel only", async () => {
    const ctx = makeConnectionContext("conn-6", () => undefined);
    const bootstrap = waitForConnectionBootstrap(ctx);
    const actor = ihsm.makeTestActor(CBConnectionTop, ctx, makeMockConnectionOrchestratorPort());
    await actor.hsm.sync();
    await bootstrap;
    await actor.hsm.sync();
    const cmdPort = ctx.channelPorts!.command! as ReturnType<typeof ihsm.makeTestPort<MockCBCommandChannelPort>>;
    const notifPort = ctx.channelPorts!.notification! as ReturnType<typeof ihsm.makeTestPort<MockCBNotificationChannelPort>>;
    const ipcCovered = new Set<string>();
    for (const testCase of MOCK_COMMAND_CHANNEL_DISPATCH_CASES) {
      const cmdWritesBefore = cmdPort.write.calls.length;
      const notifWritesBefore = notifPort.write.calls.length;
      const answerP = waitCommand(testCase.run(actor));
      await actor.hsm.sync();
      const answer = await answerP;
      await actor.hsm.sync();
      expect(answer.ok, `${testCase.label} completion=${answer.completion}`).to.equal(true);
      expect(cmdPort.write.calls.length, `${testCase.label} must write command channel`).to.be.greaterThan(cmdWritesBefore);
      expect(notifPort.write.calls.length, `${testCase.label} must not write notification channel`).to.equal(notifWritesBefore);
      ipcCovered.add(testCase.ipc);
    }
    assertMockCommandChannelCoverage(ipcCovered);
    const stopAnswerP = waitCommand(actor.call.stopServer(""));
    await actor.hsm.sync();
    const stopAnswer = await stopAnswerP;
    for (let i = 0; i < 10 && actor.hsm.currentStateName !== "ConnectionClosed"; i += 1) {
      await actor.hsm.sync();
    }
    expect(stopAnswer.ok).to.equal(true);
    expect(actor.hsm.currentStateName).to.equal("ConnectionClosed");
  });

  it("getNotificationMessage reads from the notification channel only", async () => {
    const ctx = makeConnectionContext("conn-6b", () => undefined);
    const bootstrap = waitForConnectionBootstrap(ctx);
    const actor = ihsm.makeTestActor(CBConnectionTop, ctx, makeMockConnectionOrchestratorPort());
    await actor.hsm.sync();
    await bootstrap;
    await actor.hsm.sync();
    const cmdPort = ctx.channelPorts!.command! as ReturnType<typeof ihsm.makeTestPort<MockCBCommandChannelPort>>;
    const notifPort = ctx.channelPorts!.notification! as ReturnType<typeof ihsm.makeTestPort<MockCBNotificationChannelPort>>;
    const cmdWritesBefore = cmdPort.write.calls.length;
    const answerP = waitCommand(actor.call.getNotificationMessage(500));
    await actor.hsm.sync();
    await new Promise<void>((resolve) => { setImmediate(resolve); });
    const payload = `ipcanswer("cbserver",notification,${encodeCbString("view(EmpView)")}).`;
    notifPort.send("onSocketData", formatTcpLengthFrame(payload));
    const answer = await answerP;
    await actor.hsm.sync();
    expect(answer.completion).to.equal("notification");
    expect(answer.result).to.equal("view(EmpView)");
    expect(cmdPort.write.calls.length).to.equal(cmdWritesBefore);
  });

  it("getClientId and getNotificationClientId return distinct enroll ids", async () => {
    const ctx = makeConnectionContext("conn-7", () => undefined);
    const bootstrap = waitForConnectionBootstrap(ctx);
    const actor = ihsm.makeTestActor(CBConnectionTop, ctx, makeMockConnectionOrchestratorPort());
    await actor.hsm.sync();
    await bootstrap;
    await actor.hsm.sync();
    const cmdId = await actor.call.getClientId();
    const notifId = await actor.call.getNotificationClientId();
    const connId = await actor.call.getConnectionId();
    expect(connId).to.equal("conn-7");
    expect(cmdId).to.equal("mock-cmd-client");
    expect(notifId).to.equal("mock-notify-client");
    expect(notifId).to.not.equal(cmdId);
  });
});
