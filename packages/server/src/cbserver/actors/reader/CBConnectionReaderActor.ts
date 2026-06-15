import * as ihsm from "ihsm";
import type { CBAnswer } from "../../shared/CBServerDefs";
import type { CBCommandChannelActorRef } from "../commandChannel/CBCommandChannelConfig";
import type { CBNotificationChannelActorRef } from "../notificationChannel/CBNotificationChannelConfig";
import { isIpcNotification } from "../../shared/cbIpcCatalog";
import { CBConnectionReaderTop } from "./CBConnectionReaderConfig";
import type { CBConnectionReaderMachineConfig } from "./CBConnectionReaderConfig";
import { CBConnectionReaderContext } from "./CBConnectionReaderContext";
import * as inv from "./CBConnectionReaderInvariants";
import * as self from "./CBConnectionReaderActor";

/**
 * TCP reader — state hierarchy (* = {@link ihsm.InitialState})
 *
 * ```text
 * CBConnectionReaderTop
 * * ReaderUninitialized
 * - ReaderInitialized
 *   * ReaderIdle
 *   - ReaderAwaiting
 *   - ReaderIgnored
 *     - ReaderStopped
 * ```
 */

export class ReaderInitialized extends CBConnectionReaderTop {
  protected override _checkInvariant(): void {
    // Parent connection may forward socket bytes or interrupt.
    inv.assertReaderInitialized(this.ctx);
  }

  beginAwait(): void {
    throw new Error("reader is not idle");
  }

  interrupt(): void {
    this._checkInvariant();
    this.ctx.interrupt();
    this.hsm.transition(ReaderStopped);
  }
}

@ihsm.InitialState
export class ReaderUninitialized extends CBConnectionReaderTop {
  protected override _checkInvariant(): void {
    // Constructed; initialize() not yet called.
    inv.assertReaderUninitialized(this.ctx);
  }

  async initialize(): Promise<void> {
    this._checkInvariant();
    this.hsm.transition(ReaderInitialized);
  }

  interrupt(): void {
    this._checkInvariant();
    this.ctx.interrupt();
    this.ctx.postInterrupted();
  }
}

/** Late stream events after interrupt — ignored. */
export class ReaderIgnored extends ReaderInitialized {
  protected override _checkInvariant(): void {
    // Interrupt flag set; parent must not drive new reads.
    inv.assertReaderStopped(this.ctx);
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

  beginAwait(): void {
    this._checkInvariant();
  }
}

export class ReaderStopped extends ReaderIgnored {
  onEntry(): void {
    this.ctx.resetBuffer();
    this.ctx.postInterrupted();
    inv.assertReaderStopped(this.ctx);
  }
}

@ihsm.InitialState
export class ReaderIdle extends ReaderInitialized {
  protected override _checkInvariant(): void {
    // Draining spontaneous notifications only.
    inv.assertReaderIdle(this.ctx);
  }

  onData(chunk: string): void {
    this._checkInvariant();
    this.ctx.appendChunk(chunk);
    this.ctx.drainSpontaneousNotifications();
  }

  onEnd(): void {
    this._checkInvariant();
    this.ctx.drainSpontaneousNotifications();
  }

  onStreamClose(): void {
    this._checkInvariant();
    this.ctx.drainSpontaneousNotifications();
  }

  onStreamError(message: string): void {
    this._checkInvariant();
    this.ctx.postFailed(message);
  }

  beginAwait(): void {
    this._checkInvariant();
    this.hsm.transition(ReaderAwaiting);
  }
}

export class ReaderAwaiting extends ReaderInitialized {
  protected override _checkInvariant(): void {
    // One ipcanswer completes the parent connection's active request.
    inv.assertReaderAwaiting(this.ctx);
  }

  onEntry(): void {
    for (;;) {
      const answer: CBAnswer | undefined = this.ctx.tryTakeAnswer();
      if (answer === undefined) {
        break;
      }
      if (isIpcNotification(answer.completion)) {
        this.ctx.postNotification(answer);
        continue;
      }
      this.notifyNow.onAnswerReady(answer);
      return;
    }
    inv.assertReaderAwaiting(this.ctx);
  }

  onData(chunk: string): void {
    this._checkInvariant();
    this.ctx.appendChunk(chunk);
    const answer: CBAnswer | undefined = this.ctx.tryTakeAnswer();
    if (answer === undefined) {
      return;
    }
    if (isIpcNotification(answer.completion)) {
      this.ctx.postNotification(answer);
      return;
    }
    this.notify.onAnswerReady(answer);
  }

  onEnd(): void {
    this._checkInvariant();
    const answer: CBAnswer | undefined = this.ctx.tryTakeAnswer();
    if (answer !== undefined) {
      if (isIpcNotification(answer.completion)) {
        this.ctx.postNotification(answer);
        this.ctx.postFailed("socket ended before ipcanswer");
        return;
      }
      this.notify.onAnswerReady(answer);
      return;
    }
    this.ctx.postFailed("socket ended before ipcanswer");
  }

  onStreamClose(): void {
    this.onEnd();
  }

  onStreamError(message: string): void {
    this._checkInvariant();
    this.ctx.postFailed(message);
  }

  onAnswerReady(answer: CBAnswer): void {
    this._checkInvariant();
    this.hsm.transition(ReaderIdle);
    this.ctx.postAnswer(answer);
  }
}

export { CBConnectionReaderTop };

ihsm.registerStateNames({ CBConnectionReaderTop });
ihsm.registerStateNames(self);
