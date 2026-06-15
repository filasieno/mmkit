/**
 * Parent-process exit must reap tracked cbserver children.
 */
/// <reference types="mocha" />
import { spawn } from "node:child_process";
import { expect } from "chai";
import { killCbserverProcessTree } from "../../src/cbserver/actors/server/CBServerPort";
import { CBServerConfig } from "../../src/cbserver/actors/server/CBServerConfig";
import { CBServerPort } from "../../src/cbserver/actors/server/CBServerPort";

function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

describe("CBServerPort parent exit reap", function () {
  this.timeout(5_000);

  it("installs a process exit listener when cbserver is spawned", async function () {
    const before = process.listenerCount("exit");
    const port = new CBServerPort();
    const config = new CBServerConfig({
      launch: { executablePath: process.execPath, extraArgs: ["-e", "setInterval(()=>{},1e6)"] },
      network: { port: 0 },
      paths: {
        dataDir: "",
        updateMode: "nonpersistent",
        newDatabasePath: `/tmp/mmkit-parent-exit-${process.pid}`,
        resetOnStart: true,
      },
    });

    let pid: number | undefined;
    try {
      const spawned = await port.spawn(config);
      pid = spawned.value;
      expect(process.listenerCount("exit")).to.be.greaterThan(before);
    } catch {
      this.skip();
      return;
    } finally {
      if (pid !== undefined) {
        killCbserverProcessTree(pid, "SIGKILL");
      }
    }
  });

  it("killCbserverProcessTree terminates a detached child process group", async () => {
    const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1_000_000)"], {
      stdio: "ignore",
      detached: process.platform !== "win32",
    });
    const pid = child.pid;
    expect(pid).to.be.a("number");
    expect(isRunning(pid!)).to.equal(true);

    killCbserverProcessTree(pid!, "SIGKILL");
    await new Promise<void>((resolve) => child.once("exit", () => resolve()));

    expect(isRunning(pid!)).to.equal(false);
  });
});
