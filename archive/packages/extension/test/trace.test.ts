import { expect } from "chai";
import { MmkitTraceWriter } from "../src/logging/trace";

describe("MmkitTraceWriter", () => {
  it("formats ihsm transition traces as INFO", () => {
    const lines: string[] = [];
    const channel = { appendLine: (line: string) => lines.push(line) };
    const writer = new MmkitTraceWriter("server.manager", channel as never);
    writer.write(
      {
        currentStateName: "InstallingPrepare",
        eventName: "installPrepare",
        eventPayload: [],
      } as never,
      "started transition from Idle to InstallingPrepare"
    );
    expect(lines[0]).to.include("INFO");
    expect(lines[0]).to.include("[server.manager]");
    expect(lines[0]).to.include("InstallingPrepare");
  });

  it("emits structured debug lines with event context", () => {
    const lines: string[] = [];
    const channel = { appendLine: (line: string) => lines.push(line) };
    const writer = new MmkitTraceWriter("server.manager", channel as never, "trace");
    writer.debug(
      { currentStateName: "InstallingAwaitPort", eventName: "installAwaitPort", eventPayload: [] } as never,
      "install progress",
      { step: "awaitPort", percent: 85 }
    );
    expect(lines[0]).to.include("DEBUG");
    expect(lines[0]).to.include("#installAwaitPort");
    expect(lines[0]).to.include("install progress");
  });
});
