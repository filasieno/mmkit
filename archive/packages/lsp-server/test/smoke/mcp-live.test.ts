import { expect } from "chai";
import * as fs from "node:fs";
import * as net from "node:net";
import * as os from "node:os";
import * as path from "node:path";
import { CONNECTION_TEST_ASK_QUERY, isExistsClassYes } from "@mmkit/shared";
import { createMmkitServerActor } from "../../src/cbserver/mmkit-server/mmkit-server-actor.hsm";
import type { ServerNotifier } from "../../src/cbserver/mmkit-server/server-notifier";
import { CbTcpClient } from "../../src/mcp/cb-tcp-client";
import { waitForHsmState } from "../helpers/hsm";
import { testSnapshot } from "../helpers/test-snapshot";
import { createRealPorts } from "../../src/shared/ports";

const LIVE = process.env.MMKIT_MCP_LIVE === "1";
const CBSERVER_BIN = process.env.MMKIT_CBSERVER_BIN;

function probePort(host: string, port: number, timeoutMs = 500): Promise<boolean> {
  return new Promise((resolve) => {
    const s = net.connect(port, host, () => {
      s.end();
      resolve(true);
    });
    s.setTimeout(timeoutMs);
    s.on("timeout", () => {
      s.destroy();
      resolve(false);
    });
    s.on("error", () => resolve(false));
  });
}

(LIVE ? describe : describe.skip)("MCP live cbserver", function () {
  this.timeout(120_000);

  it("starts real cbserver and answers ASK via CbTcpClient", async function () {
    if (!CBSERVER_BIN || !fs.existsSync(CBSERVER_BIN)) {
      this.skip();
    }

    process.env.MMKIT_CBSERVER_BIN = CBSERVER_BIN;
    process.env.MMKIT_PORT_PROBE_ATTEMPTS = "40";
    process.env.MMKIT_PORT_PROBE_INTERVAL_MS = "1000";

    const faults: string[] = [];

    const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), "mmkit-live-"));
    const port = 14000 + Math.floor(Math.random() * 1000);
    await fs.promises.mkdir(path.join(tmp, "workspace"), { recursive: true });
    await fs.promises.mkdir(path.join(tmp, "tmp"), { recursive: true });
    await fs.promises.mkdir(path.join(tmp, "load"), { recursive: true });
    await fs.promises.writeFile(path.join(tmp, ".mmkit-installed"), "{}", "utf8");

    const snapshot = testSnapshot({
      launchKind: "executable",
      executablePath: CBSERVER_BIN,
      devCommand: CBSERVER_BIN,
      port,
      dataDir: tmp,
    });
    snapshot.paths.dataDir = tmp;
    snapshot.paths.databaseAllPath = path.join(tmp, "workspace");
    snapshot.paths.tmpDir = path.join(tmp, "tmp");
    snapshot.paths.loadDir = path.join(tmp, "load");
    snapshot.paths.installMarker = path.join(tmp, ".mmkit-installed");
    snapshot.server.dataDir = tmp;

    const notifier: ServerNotifier = {
      emitState: (n) => {
        if (n.fault) faults.push(n.fault);
      },
      reportInstallProgress: () => undefined,
      showInstallProgress: () => undefined,
      hideInstallProgress: () => undefined,
    };

    const actor = createMmkitServerActor({
      ports: createRealPorts(),
      notifier,
      shutdownRequested: false,
      progressVisible: false,
    });

    actor.post("userStart", snapshot, 1);
    try {
      await waitForHsmState(actor, "Running", { timeoutMs: 90_000 });
    } catch (err) {
      throw new Error(`${err instanceof Error ? err.message : err}; faults=${faults.join(" | ")}`);
    }

    expect(await probePort("127.0.0.1", port)).to.equal(true);

    const client = new CbTcpClient({ host: "127.0.0.1", port, toolName: "mcp-smoke", userName: "test" });
    const enroll = await client.connect();
    expect(enroll.ok, enroll.result).to.equal(true);

    const ask = await client.ask(CONNECTION_TEST_ASK_QUERY);
    expect(ask.ok, ask.result).to.equal(true);
    expect(isExistsClassYes(ask.result)).to.equal(true);

    await client.disconnect();
    actor.post("userStop");
    await waitForHsmState(actor, "Idle", { timeoutMs: 30_000 });
  });
});
