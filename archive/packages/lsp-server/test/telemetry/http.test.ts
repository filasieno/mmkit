import { expect } from "chai";
import * as http from "node:http";
import { startTelemetryHttpServer, type ReadinessState } from "../../src/shared/telemetry/http";
import { createLspMetrics } from "../../src/shared/telemetry/metrics";
import { withTimeout } from "../helpers/async";

function get(url: string): Promise<number> {
  return withTimeout(
    new Promise((resolve, reject) => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve(res.statusCode ?? 0);
      });
      req.on("error", reject);
    }),
    5_000,
    `GET ${url}`
  );
}

function waitForListen(server: http.Server): Promise<number> {
  return withTimeout(
    new Promise((resolve, reject) => {
      server.once("error", reject);
      server.once("listening", () => {
        const addr = server.address();
        if (!addr || typeof addr === "string") {
          reject(new Error("expected TCP listen address"));
          return;
        }
        resolve(addr.port);
      });
    }),
    5_000,
    "HTTP server listen"
  );
}

describe("telemetry HTTP", () => {
  it("returns 503 on /readyz until the LSP transport is started", async () => {
    const readiness: ReadinessState = { started: false, lspInitialized: false };
    const server = startTelemetryHttpServer(0, readiness, createLspMetrics().registry);
    if (!server) {
      expect.fail("expected HTTP server");
    }
    const port = await waitForListen(server);
    try {
      expect(await get(`http://127.0.0.1:${port}/readyz`)).to.equal(503);
      readiness.started = true;
      expect(await get(`http://127.0.0.1:${port}/readyz`)).to.equal(200);
      expect(await get(`http://127.0.0.1:${port}/healthz`)).to.equal(200);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
    }
  });

  it("does not require lspInitialized for /readyz", async () => {
    const readiness: ReadinessState = { started: true, lspInitialized: false };
    const server = startTelemetryHttpServer(0, readiness, createLspMetrics().registry);
    if (!server) {
      expect.fail("expected HTTP server");
    }
    const port = await waitForListen(server);
    try {
      expect(await get(`http://127.0.0.1:${port}/readyz`)).to.equal(200);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
    }
  });
});
