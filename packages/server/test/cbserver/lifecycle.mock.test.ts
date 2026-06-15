/**
 * Mock ports — lifecycle: ENROLL, CANCEL_ME graceful close, supervisor stop.
 * Identical to lifecycle.real.test.ts; only the harness differs.
 */
/// <reference types="mocha" />
import { expect } from "chai";
import { waitCommand } from "../../src/cbserver/shared/CBServerDefs";
import {
  gracefulCloseConnection,
  installMockTestGuards,
  MS,
  openConnection,
  PER_TEST_TIMEOUT_MS,
  raceTimeout,
  runCommand,
  type MockRunningServer,
  waitForRegistrySize,
  waitForServerState,
  withMockServer,
  withMockSession,
} from "./mockHarness";

describe("CBServer lifecycle [mock port]", function () {
  this.timeout(PER_TEST_TIMEOUT_MS);
  installMockTestGuards(this);

  it("ENROLL on connect, CANCEL_ME on close, supervisor reaches Stopped", async function () {
    await withMockSession("lifecycle-cancel", async ({ server, connection }) => {
      await runCommand(server, connection, "pwd-after-enroll", () => waitCommand(connection.call.pwd()));
    });
  });

  it("close is idempotent-safe on supervisor registry (one connection slot)", async function () {
    await withMockServer("lifecycle-registry", async (server) => {
      const connection = await openConnection(server);
      expect(server.ctx.connections.size).to.equal(1);
      await gracefulCloseConnection(server, connection);
      expect(server.ctx.connections.size).to.equal(0);
    });
  });

  it("two connections: close each with CANCEL_ME before server stop", async function () {
    await withMockServer("lifecycle-dual", async (server) => {
      const left = await openConnection(server);
      const right = await openConnection(server);
      expect(server.ctx.connections.size).to.equal(2);
      await runCommand(server, left, "left-pwd", () => waitCommand(left.call.pwd()));
      await runCommand(server, right, "right-pwd", () => waitCommand(right.call.pwd()));
      await gracefulCloseConnection(server, left);
      expect(server.ctx.connections.size).to.equal(1);
      await gracefulCloseConnection(server, right);
      expect(server.ctx.connections.size).to.equal(0);
    });
  });

  it("stop waits for subprocess exit (no forced SIGKILL on happy path)", async function () {
    let pid: number | undefined;
    await withMockServer("lifecycle-stop", async (server) => {
      pid = server.ctx.pid;
      expect(pid).to.be.a("number");
      const connection = await openConnection(server);
      await gracefulCloseConnection(server, connection);
    });
    await raceTimeout(
      new Promise<void>((resolve, reject) => {
        try {
          process.kill(pid!, 0);
          reject(new Error(`mock cbserver pid ${pid} still running after graceful stop`));
        } catch {
          resolve();
        }
      }),
      "process-reaped",
      MS.stop,
    );
  });

  it("server stop closes open connections before SIGTERM", async function () {
    await withMockServer("lifecycle-stop-open-conn", async (server) => {
      expect(server.ctx.pid).to.be.a("number");
      let connectionsAtKill = -1;
      const mockPort = server.port as MockRunningServer["port"];
      mockPort.kill.once(async (targetPid, signal) => {
        connectionsAtKill = server.ctx.connections.size;
        mockPort.record("kill", targetPid, signal);
        mockPort.send("onProcessExit", 0, null);
      });
      const connection = await openConnection(server);
      await runCommand(server, connection, "pwd-before-stop", () => waitCommand(connection.call.pwd()));
      expect(server.ctx.connections.size).to.equal(1);
      server.actor.notify.stop();
      await waitForRegistrySize(server, "stop-closes-connections", 0);
      await waitForServerState(server, "Stopped", "stop-with-open-conn");
      expect(connectionsAtKill).to.equal(0);
    });
  });
});
