import { expect } from "chai";
import * as ihsm from "ihsm";
import { parseOtelTraceLevel, shouldEmitLog, otelToIhsmTraceLevel } from "../src/logging/trace-level";
import { ActorRegistry } from "../src/registry";
import { DEFAULT_RAW } from "../src/config/schema";
import { buildSnapshot } from "../src/config/snapshot";
import { createExtensionSupervisor } from "../src/actors/extension-supervisor";
import { createSimPorts } from "../src/ports/sim/sim-ports";
import { MmkitTraceWriter } from "../src/logging/trace";
import { ACTOR_IDS } from "../src/registry";
import { waitForHsmState } from "./helpers/hsm";

describe("trace level", () => {
  it("parses OTEL levels", () => {
    expect(parseOtelTraceLevel("debug")).to.equal("debug");
    expect(parseOtelTraceLevel("bogus")).to.equal("trace");
  });

  it("filters logs by minimum severity", () => {
    expect(shouldEmitLog("warn", "info")).to.equal(false);
    expect(shouldEmitLog("warn", "error")).to.equal(true);
    expect(shouldEmitLog("off", "debug")).to.equal(false);
    expect(shouldEmitLog("off", "error")).to.equal(true);
  });

  it("maps OTEL level to ihsm TraceLevel", () => {
    expect(otelToIhsmTraceLevel("trace")).to.equal(ihsm.TraceLevel.VERBOSE_DEBUG);
    expect(otelToIhsmTraceLevel("debug")).to.equal(ihsm.TraceLevel.DEBUG);
    expect(otelToIhsmTraceLevel("warn")).to.equal(ihsm.TraceLevel.PRODUCTION);
  });

  it("supervisor fans traceLevelChanged to child actors", async () => {
    const registry = new ActorRegistry();
    const ports = createSimPorts();
    const supervisor = createExtensionSupervisor({
      ports,
      registry,
      trace: new MmkitTraceWriter(ACTOR_IDS.supervisor),
      disposables: [],
      mode: "none",
    });
    registry.register(ACTOR_IDS.supervisor, supervisor as never);
    supervisor.post("hostActivated", {
      subscriptions: { push: () => ({ dispose: () => undefined }) },
      extensionMode: 3,
    } as unknown as import("vscode").ExtensionContext);
    await waitForHsmState(registry, supervisor, "Active", 10_000);

    supervisor.post("traceLevelChanged", "warn");
    await registry.syncAll();
    await supervisor.sync();

    const languageServer = registry.get(ACTOR_IDS.languageServer);
    expect(languageServer?.traceLevel).to.equal(ihsm.TraceLevel.PRODUCTION);
    expect(ports.sim.panel.lastViewModel?.traceLevel).to.equal("warn");
  });
});
