#!/usr/bin/env node
/**
 * Spawn cbserver via CBServerPort, print child pid, then block until the parent exits.
 * Parent-exit hooks in CBServerPort must SIGKILL the child when this process ends.
 *
 * Build first:  npx tsc -p test/cbserver/tsconfig.json
 * Run (nix):     nix develop .#mmkit -c node scripts/verify-parent-exit-reap.mjs
 */
import { createServer } from "node:net";
import { createCBServerActor } from "../out-test/src/cbserver/actors/server/CBServerActor.js";
import { CBServerConfig } from "../out-test/src/cbserver/actors/server/CBServerConfig.js";
import { CBServerContext } from "../out-test/src/cbserver/actors/server/CBServerContext.js";
import { CBServerPort } from "../out-test/src/cbserver/actors/server/CBServerPort.js";

async function pickFreePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        server.close(() => reject(new Error("failed to bind ephemeral port")));
        return;
      }
      const port = address.port;
      server.close((err) => (err ? reject(err) : resolve(port)));
    });
  });
}

const portNr = await pickFreePort();
const dbPath = `/tmp/mmkit-parent-exit-demo-${process.pid}`;
const config = new CBServerConfig({
  launch: {},
  network: { port: portNr },
  paths: {
    dataDir: "",
    updateMode: "nonpersistent",
    newDatabasePath: dbPath,
    resetOnStart: true,
  },
  mmkit: { killGraceMs: 1_500 },
});

const ctx = new CBServerContext(config);
const port = new CBServerPort();
const actor = createCBServerActor(ctx, port);

await actor.call.initialize();
actor.notify.start();

for (let i = 0; i < 60; i++) {
  await actor.hsm.sync();
  if (actor.hsm.currentStateName === "Running" && ctx.pid !== undefined) {
    console.log(`CBSERVER_PID=${ctx.pid}`);
    console.log(`CBSERVER_PORT=${portNr}`);
    await new Promise((resolve) => setTimeout(resolve, 120_000));
    process.exit(0);
  }
  await new Promise((resolve) => setTimeout(resolve, 200));
}

console.error("cbserver did not reach Running");
process.exit(1);
