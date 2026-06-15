/**
 * CBServer stderr line-reader subactor — deterministic mock tests.
 */
/// <reference types="mocha" />
import { expect } from "chai";
import * as ihsm from "ihsm/testing";
import { StderrLogReaderTop, } from "../../../src/cbserver/actors/stderrLogReader/CBServerStderrReaderActor";
import { StderrReaderContext } from "../../../src/cbserver/actors/stderrLogReader/CBServerStderrReaderContext";
import type { CBServerActorRef } from "../../../src/cbserver/actors/server/CBServerConfig";

describe( "CBServer stderr reader subactor", function () { this.timeout(1_000); it("initialize reaches StderrIdle", async () => { const ctx = new StderrReaderContext(); const actor = ihsm.makeTestActor(StderrLogReaderTop, ctx); await actor.hsm.sync(); await actor.call.initialize(); await actor.hsm.sync(); expect(actor.hsm.currentStateName).to.equal("StderrIdle"); }); it("onData emits complete lines via supervisor onStderrLine", async () => { const lines: string[] = []; const server: CBServerActorRef = { notify: { onStderrLine(line: string) { lines.push(line); }, onStderrLogReaderInterrupted() {}, }, } as unknown as CBServerActorRef; const ctx = new StderrReaderContext(server); const actor = ihsm.makeTestActor(StderrLogReaderTop, ctx); await actor.hsm.sync(); await actor.call.initialize(); await actor.hsm.sync(); actor.notify.onData("alpha\nbeta\n"); await actor.hsm.sync(); expect(lines).to.deep.equal(["alpha", "beta"]); }); it("onEnd flushes a trailing partial line", async () => { const lines: string[] = []; const server: CBServerActorRef = { notify: { onStderrLine(line: string) { lines.push(line); }, onStderrLogReaderInterrupted() {}, }, } as unknown as CBServerActorRef; const ctx = new StderrReaderContext(server); const actor = ihsm.makeTestActor(StderrLogReaderTop, ctx); await actor.hsm.sync(); await actor.call.initialize(); await actor.hsm.sync(); actor.notify.onData("tail"); actor.notify.onEnd(); await actor.hsm.sync(); expect(lines).to.deep.equal(["tail"]); }); } );
