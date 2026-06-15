import * as net from "node:net";
import type { PortProbeResult } from "@mmkit/shared";
import type { NetworkPort } from "../types";

export class RealNetworkPort implements NetworkPort {
  probe(host: string, port: number, timeoutMs: number): Promise<PortProbeResult> {
    const started = Date.now();
    return new Promise((resolve) => {
      const socket = new net.Socket();
      const done = (result: PortProbeResult) => {
        socket.destroy();
        resolve(result);
      };
      socket.setTimeout(timeoutMs);
      socket.once("connect", () => {
        done({ reachable: true, latencyMs: Date.now() - started });
      });
      socket.once("timeout", () => done({ reachable: false, error: "timeout" }));
      socket.once("error", (err) => done({ reachable: false, error: String(err) }));
      socket.connect(port, host);
    });
  }
}
