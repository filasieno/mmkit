import type { CBServerActorRef } from "../server/CBServerConfig";

/**
 * Mutable domain state for the stderr log line-reader child.
 *
 * - `server` — supervisor mailbox for `onStderrLine` / `onStderrLogReaderInterrupted`.
 * - `lineBuffer` — partial line between `\n`-delimited chunks (invariant: empty when Stopped).
 * - `interrupted` / `interruptedPosted` — teardown: suppress `emitLine`; ack interrupt once.
 */
export interface IStderrReaderContext {
  readonly server: CBServerActorRef | undefined;
  interrupted: boolean;
  interruptedPosted: boolean;
  lineBuffer: string;
  assertDisarmed(): void;
  interrupt(): void;
  postInterrupted(): void;
  appendChunk(chunk: string): string[];
  flushLineBuffer(): string[];
  resetIdle(): void;
  emitLine(line: string): void;
}

export class StderrReaderContext implements IStderrReaderContext {
  readonly server: CBServerActorRef | undefined;
  interrupted = false;
  interruptedPosted = false;
  lineBuffer = "";

  constructor(server?: CBServerActorRef) {
    this.server = server;
  }

  assertDisarmed(): void {
    if (this.lineBuffer.length > 0) {
      throw new Error("invariant violation: stderr line buffer must be empty when disarmed");
    }
  }

  interrupt(): void {
    this.interrupted = true;
  }

  postInterrupted(): void {
    if (this.interruptedPosted) {
      return;
    }
    this.interruptedPosted = true;
    this.server?.notify.onStderrLogReaderInterrupted();
  }

  appendChunk(chunk: string): string[] {
    if (chunk.length === 0) {
      return [];
    }
    const next = this.lineBuffer + chunk;
    const lines = next.split("\n");
    this.lineBuffer = lines.pop() ?? "";
    return lines;
  }

  flushLineBuffer(): string[] {
    if (this.lineBuffer.length === 0) {
      return [];
    }
    const line = this.lineBuffer;
    this.lineBuffer = "";
    return [line];
  }

  resetIdle(): void {
    this.lineBuffer = "";
  }

  emitLine(line: string): void {
    if (this.interrupted) {
      return;
    }
    this.server?.notify.onStderrLine(line);
  }
}
