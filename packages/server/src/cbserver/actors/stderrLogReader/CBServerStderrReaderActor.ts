import * as ihsm from "ihsm";
import type { CBServerActorRef } from "../server/CBServerConfig";
import type { StderrLogReaderMachineConfig } from "./CBServerStderrReaderConfig";
import { StderrLogReaderTop } from "./CBServerStderrReaderConfig";
import { StderrReaderContext } from "./CBServerStderrReaderContext";
import type { IStderrReaderContext } from "./CBServerStderrReaderContext";
import * as inv from "./CBServerStderrLogReaderInvariants";
import * as self from "./CBServerStderrReaderActor";

/**
 * Stderr line-reader — state hierarchy (* = {@link ihsm.InitialState})
 *
 * ```text
 * StderrReaderTop
 * * StderrUninitialized
 * - StderrInitialized
 *   * StderrIdle
 *   - StderrStopped
 * ```
 */

export class StderrInitialized extends StderrLogReaderTop {
  /**
   * Past `initialize()` — if teardown has started, no partial stderr line may
   * remain buffered (we do not emit log lines after interrupt).
   */
  protected override _checkInvariant(): void {
    inv.assertStderrLogInitialized(this.ctx);
  }

  async getCurrentStateName(): Promise<string> {
    this._checkInvariant();
    return this.hsm.currentStateName;
  }

  interrupt(): void {
    this._checkInvariant();
    this.ctx.interrupt();
    this.hsm.transition(StderrStopped);
  }

  stop(): void {
    this._checkInvariant();
    this.hsm.transition(StderrStopped);
  }
}

@ihsm.InitialState
export class StderrUninitialized extends StderrLogReaderTop {
  /**
   * Actor created; not yet splitting stderr into lines. Line buffer empty and
   * no teardown in progress.
   */
  protected override _checkInvariant(): void {
    inv.assertStderrLogUninitialized(this.ctx);
  }

  async initialize(): Promise<void> {
    this._checkInvariant();
    this.hsm.transition(StderrInitialized);
  }

  stop(): void {
    this._checkInvariant();
  }

  interrupt(): void {
    this._checkInvariant();
    this.ctx.interrupt();
    this.ctx.postInterrupted();
  }
}

export class StderrStopped extends StderrInitialized {
  /**
   * Terminal — line buffer cleared; further stderr data ignored. Supervisor
   * receives an interrupt acknowledgement on entry.
   */
  protected override _checkInvariant(): void {
    inv.assertStderrLogStopped(this.ctx);
  }

  onEntry(): void {
    this.ctx.resetIdle();
    this.ctx.postInterrupted();
    inv.assertStderrLogStopped(this.ctx);
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
export class StderrIdle extends StderrInitialized {
  /**
   * Accepting stderr chunks, splitting on newlines, and forwarding complete
   * lines to the supervisor for `subscribeProcessIo`.
   */
  protected override _checkInvariant(): void {
    inv.assertStderrLogIdle(this.ctx);
  }

  onEntry(): void {
    this.ctx.resetIdle();
    inv.assertStderrLogIdle(this.ctx);
  }

  onData(chunk: string): void {
    this._checkInvariant();
    for (const line of this.ctx.appendChunk(chunk)) {
      this.ctx.emitLine(line);
    }
  }

  onEnd(): void {
    this._checkInvariant();
    for (const line of this.ctx.flushLineBuffer()) {
      this.ctx.emitLine(line);
    }
  }

  onStreamClose(): void {
    this._checkInvariant();
    for (const line of this.ctx.flushLineBuffer()) {
      this.ctx.emitLine(line);
    }
  }

  onStreamError(message: string): void {
    this._checkInvariant();
    this.ctx.emitLine(`[stderr error] ${message}`);
  }
}

export function createStderrReaderContext(server?: CBServerActorRef): StderrReaderContext {
  return new StderrReaderContext(server);
}

export { StderrLogReaderTop };

ihsm.registerStateNames({ StderrLogReaderTop });
ihsm.registerStateNames(self);
