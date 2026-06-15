import { expect } from "chai";
import { createClientManager } from "../src/actors/client-manager";
import { DEFAULT_RAW } from "../src/config/schema";
import { buildSnapshot } from "../src/config/snapshot";
import { MmkitTraceWriter } from "../src/logging/trace";
import { createSimPorts } from "../src/ports/sim/sim-ports";
import { ACTOR_IDS, ActorRegistry } from "../src/registry";
import { waitForHsmState } from "./helpers/hsm";

describe("ClientManager", () => {
  it("connects and enrolls via simulated TCP", async () => {
    const registry = new ActorRegistry();
    const ports = createSimPorts();
    const snapshot = buildSnapshot(
      {
        ...DEFAULT_RAW,
        operationalMode: "client",
        client: { ...DEFAULT_RAW.client, autoConnect: false },
      },
      1
    );

    const client = createClientManager({
      ports,
      registry,
      trace: new MmkitTraceWriter(ACTOR_IDS.client),
      enabled: false,
      clientName: '""',
      serverName: '""',
      shutdownRequested: false,
      disableAfterStop: false,
    });
    registry.register(ACTOR_IDS.client, client as never);

    client.post("enable", snapshot);
    await client.sync();
    client.post("userConnect");
    await waitForHsmState(registry, client, "Connected");

    const ctx = (client as { ctx: { socketId?: string; serverName: string } }).ctx;
    expect(ctx.socketId).to.be.a("string");
    expect(ctx.serverName).to.equal('"cbserver"');
  });

  it("auto-connects when enabled with autoConnect", async () => {
    const registry = new ActorRegistry();
    const ports = createSimPorts();
    const snapshot = buildSnapshot(
      {
        ...DEFAULT_RAW,
        operationalMode: "client",
        client: { ...DEFAULT_RAW.client, autoConnect: true },
      },
      1
    );

    const client = createClientManager({
      ports,
      registry,
      trace: new MmkitTraceWriter(ACTOR_IDS.client),
      enabled: false,
      clientName: '""',
      serverName: '""',
      shutdownRequested: false,
      disableAfterStop: false,
    });

    client.post("enable", snapshot);
    await waitForHsmState(registry, client, "Connected");
  });

  it("disconnects on userDisconnect from Connected", async () => {
    const registry = new ActorRegistry();
    const ports = createSimPorts();
    const snapshot = buildSnapshot({ ...DEFAULT_RAW, operationalMode: "client" }, 1);

    const client = createClientManager({
      ports,
      registry,
      trace: new MmkitTraceWriter(ACTOR_IDS.client),
      enabled: false,
      clientName: '""',
      serverName: '""',
      shutdownRequested: false,
      disableAfterStop: false,
    });
    registry.register(ACTOR_IDS.client, client as never);

    client.post("enable", snapshot);
    await client.sync();
    client.post("userConnect");
    await waitForHsmState(registry, client, "Connected");

    client.post("userDisconnect");
    await waitForHsmState(registry, client, "Idle");
    expect((client as { ctx: { socketId?: string } }).ctx.socketId).to.equal(undefined);
  });

  it("returns to Idle on connect failure", async () => {
    const registry = new ActorRegistry();
    const ports = createSimPorts();
    ports.sim.tcp.failConnect = true;
    const snapshot = buildSnapshot({ ...DEFAULT_RAW, operationalMode: "client" }, 1);

    const client = createClientManager({
      ports,
      registry,
      trace: new MmkitTraceWriter(ACTOR_IDS.client),
      enabled: false,
      clientName: '""',
      serverName: '""',
      shutdownRequested: false,
      disableAfterStop: false,
    });

    client.post("enable", snapshot);
    await client.sync();
    client.post("userConnect");
    await waitForHsmState(registry, client, "Idle");
  });
});
