import * as ihsm from "ihsm";
import type { CBServerActorRef } from "../server/CBServerConfig";
import { StdoutLogReaderTop } from "./CBServerStdoutLogReaderConfig";
import type { StdoutLogReaderMachineConfig } from "./CBServerStdoutLogReaderConfig";
import { StdoutLogReaderContext } from "./CBServerStdoutLogReaderContext";
import type { IStdoutLogReaderContext } from "./CBServerStdoutLogReaderContext";
import * as inv from "./CBServerStdoutLogReaderInvariants";
import * as self from "./CBServerStdoutLogReaderActor";

/**
 * Stdout log line-reader — state hierarchy (* = {@link ihsm.InitialState})
 *
 * ```text
 * StdoutLogReaderTop
 * * StdoutLogInitialized
 *   * StdoutLogIdle
 *   - StdoutLogStopped
 * ```
 *
 * Handler matrix: `docs/cbserver-actor-handler-matrix.md` § StdoutLogReaderTop.
 * Invariant predicates: {@link CBServerStdoutLogReaderInvariants}.
 */

@ihsm.InitialState
export class StdoutLogInitialized extends StdoutLogReaderTop {
  /**
   * Past `initialize()` — if teardown has started, no partial stdout line may
   * remain buffered (we do not emit log lines after interrupt).
   */
  protected override _checkInvariant(): void {
    inv.assertStdoutLogInitialized(this.ctx);
  }

  async getCurrentStateName(): Promise<string> {
    this._checkInvariant();
    return this.hsm.currentStateName;
  }

  interrupt(): void {
    this._checkInvariant();
    this.ctx.interrupt();
    this.hsm.transition(StdoutLogStopped);
  }

  stop(): void {
    this._checkInvariant();
    this.hsm.transition(StdoutLogStopped);
  }
}

export class StdoutLogStopped extends StdoutLogInitialized {
  /**
   * Terminal — line buffer cleared; further stdout data ignored. Supervisor
   * receives an interrupt acknowledgement on entry.
   */
  protected override _checkInvariant(): void {
    inv.assertStdoutLogStopped(this.ctx);
  }

  onEntry(): void {
    this.ctx.resetIdle();
    this.ctx.postInterrupted();
    inv.assertStdoutLogStopped(this.ctx);
  }

  onData(_chunk: string): void {
    this._checkInvariant();
  }

  onEnd(): void {
    this._checkInvariant();
  }

  onStreamClose(): void {
    this._checkInvariant();
  }

  onStreamError(_message: string): void {
    this._checkInvariant();
  }
}

@ihsm.InitialState
export class StdoutLogIdle extends StdoutLogInitialized {
  /**
   * Accepting stdout chunks, splitting on newlines, and forwarding complete
   * lines to the supervisor for `subscribeProcessIo`.
   */
  protected override _checkInvariant(): void {
    inv.assertStdoutLogIdle(this.ctx);
  }

  onEntry(): void {
    this.ctx.resetIdle();
    inv.assertStdoutLogIdle(this.ctx);
  }

  onData(chunk: string): void {
    this._checkInvariant();
    for (const rawLine of this.ctx.appendChunk(chunk)) {
      const line: string = rawLine;
      this.ctx.emitLine(line);
    }
  }

  onEnd(): void {
    this._checkInvariant();
    for (const rawLine of this.ctx.flushLineBuffer()) {
      const line: string = rawLine;
      this.ctx.emitLine(line);
    }
  }

  onStreamClose(): void {
    this._checkInvariant();
    for (const rawLine of this.ctx.flushLineBuffer()) {
      const line: string = rawLine;
      this.ctx.emitLine(line);
    }
  }

  onStreamError(message: string): void {
    this._checkInvariant();
    this.ctx.emitLine(`[stdout error] ${message}`);
  }
}

export { StdoutLogReaderTop };

ihsm.registerStateNames({ StdoutLogReaderTop });
ihsm.registerStateNames(self);
