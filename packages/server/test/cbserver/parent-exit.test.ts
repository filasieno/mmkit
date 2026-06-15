/**
 * Parent-process exit must reap tracked cbserver children.
 */
/// <reference types="mocha" />
import { spawn } from "node:child_process";
import { expect } from "chai";
import { killCbserverProcessTree, registerTrackedCbserverChild, } from "../../src/cbserver/actors/server/CBServerPort";

function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

describe( "CBServerPort parent exit reap", function () { this.timeout(5_000); it("installs a process exit listener when cbserver is spawned", async function () { const before = process.listenerCount("exit"); const child = spawn(process.execPath, ["-e", "setInterval(()=>{},1e6)"], { stdio: "ignore", detached: process.platform !== "win32", windowsHide: true, }); const pid = child.pid; if (pid === undefined) { this.skip(); return; } try { registerTrackedCbserverChild(pid, child); expect(process.listenerCount("exit")).to.be.greaterThan(before); } finally { killCbserverProcessTree(pid, "SIGKILL"); await new Promise<void>((resolve) => child.once("exit", () => resolve())); } }); it("killCbserverProcessTree terminates a detached child process group", async () => { const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1_000_000)"], { stdio: "ignore", detached: process.platform !== "win32", }); const pid = child.pid; expect(pid).to.be.a("number"); expect(isRunning(pid!)).to.equal(true); killCbserverProcessTree(pid!, "SIGKILL"); await new Promise<void>((resolve) => child.once("exit", () => resolve())); expect(isRunning(pid!)).to.equal(false); }); } );
