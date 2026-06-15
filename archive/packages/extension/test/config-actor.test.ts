import { expect } from "chai";
import { createConfigActor } from "../src/actors/config-actor";
import { createExtensionSupervisor } from "../src/actors/extension-supervisor";
import { DEFAULT_RAW } from "../src/config/schema";
import { MmkitTraceWriter } from "../src/logging/trace";
import { createSimPorts } from "../src/ports/sim/sim-ports";
import { ACTOR_IDS, ActorRegistry } from "../src/registry";

describe("ConfigActor", () => {
  it("publishes a valid snapshot with resolved ~/.mmkit paths", async () => {
    const registry = new ActorRegistry();
    const ports = createSimPorts();
    const trace = new MmkitTraceWriter(ACTOR_IDS.config);
    let published: unknown;

    const supervisor = createExtensionSupervisor({
      ports,
      registry,
      trace,
      disposables: [],
      mode: "none",
    });
    registry.register(ACTOR_IDS.supervisor, supervisor as never);

    const originalPost = registry.post.bind(registry);
    registry.post = (id, event, ...args) => {
      if (event === "snapshotPublished") published = args[0];
      return originalPost(id, event, ...args);
    };

    const config = createConfigActor({
      ports,
      registry,
      trace,
      generation: 0,
      validationErrors: [],
      shutdownRequested: false,
    });
    registry.register(ACTOR_IDS.config, config as never);

    config.post("reloadFromHost");
    await config.sync();

    expect(published).to.be.an("object");
    const snap = published as { valid: boolean; paths: { dataDir: string; databaseAllPath: string } };
    expect(snap.valid).to.equal(true);
    expect(snap.paths.dataDir).to.match(/\.mmkit$/);
    expect(snap.paths.databaseAllPath).to.match(/workspace$/);
  });

  it("publishes invalid snapshot when port is out of range", async () => {
    const registry = new ActorRegistry();
    const ports = createSimPorts();
    ports.sim.config.setSettings({
      ...DEFAULT_RAW,
      server: { ...DEFAULT_RAW.server, port: 0 },
    });

    let published: { valid: boolean; errors: unknown[] } | undefined;
    let invalidErrors: unknown[] | undefined;

    const supervisor = createExtensionSupervisor({
      ports,
      registry,
      trace: new MmkitTraceWriter(ACTOR_IDS.supervisor),
      disposables: [],
      mode: "none",
    });
    registry.register(ACTOR_IDS.supervisor, supervisor as never);

    const originalPost = registry.post.bind(registry);
    registry.post = (id, event, ...args) => {
      if (event === "snapshotPublished") published = args[0] as typeof published;
      if (event === "snapshotInvalid") invalidErrors = args[0] as unknown[];
      return originalPost(id, event, ...args);
    };

    const config = createConfigActor({
      ports,
      registry,
      trace: new MmkitTraceWriter(ACTOR_IDS.config),
      generation: 0,
      validationErrors: [],
      shutdownRequested: false,
    });
    registry.register(ACTOR_IDS.config, config as never);

    config.post("reloadFromHost");
    await config.sync();

    expect(published?.valid).to.equal(false);
    expect(published?.errors.length).to.be.greaterThan(0);
    expect(invalidErrors).to.be.an("array").that.is.not.empty;
  });

  it("reloads after settingsPatch from Ready", async () => {
    const registry = new ActorRegistry();
    const ports = createSimPorts();
    const config = createConfigActor({
      ports,
      registry,
      trace: new MmkitTraceWriter(ACTOR_IDS.config),
      generation: 0,
      validationErrors: [],
      shutdownRequested: false,
    });
    registry.register(ACTOR_IDS.config, config as never);

    config.post("reloadFromHost");
    await config.sync();
    expect(config.currentStateName).to.equal("Ready");

    config.post("settingsPatch", { operationalMode: "client" });
    await config.sync();
    expect(config.currentStateName).to.equal("Ready");
    expect(config.ctx.snapshot?.operationalMode).to.equal("client");
  });
});
