import * as ihsm from "ihsm";
import type { CBCommandChannelActorRef } from "../commandChannel/CBCommandChannelConfig";
import type { CBNotificationChannelActorRef } from "../notificationChannel/CBNotificationChannelConfig";
import type { CBConnectionWriterMachineConfig } from "./CBConnectionWriterConfig";
import { CBConnectionWriterTop } from "./CBConnectionWriterConfig";
import { CBConnectionWriterContext } from "./CBConnectionWriterContext";
import * as inv from "./CBConnectionWriterInvariants";
import * as self from "./CBConnectionWriterActor";

/**
 * TCP writer — state hierarchy (* = {@link ihsm.InitialState})
 *
 * ```text
 * CBConnectionWriterTop
 * * WriterUninitialized
 * - WriterInitialized
 *   * WriterIdle
 *   - WriterSending
 *   - WriterIgnored
 *     - WriterStopped
 * ```
 */

export class WriterInitialized extends CBConnectionWriterTop {
  protected override _checkInvariant(): void {
    // Parent connection may post sendFrame or interrupt.
    inv.assertWriterInitialized(this.ctx);
  }

  async sendFrame(_frame: Buffer): Promise<void> {
    throw new Error("writer is not idle");
  }

  interrupt(): void {
    this._checkInvariant();
    this.ctx.interrupt();
    this.hsm.transition(WriterStopped);
  }
}

@ihsm.InitialState
export class WriterUninitialized extends CBConnectionWriterTop {
  protected override _checkInvariant(): void {
    // Constructed; initialize() not yet called.
    inv.assertWriterUninitialized(this.ctx);
  }

  async initialize(): Promise<void> {
    this._checkInvariant();
    this.hsm.transition(WriterInitialized);
  }

  interrupt(): void {
    this._checkInvariant();
    this.ctx.interrupt();
    this.ctx.postInterrupted();
  }
}

/** Late write completions after interrupt — ignored. */
export class WriterIgnored extends WriterInitialized {
  protected override _checkInvariant(): void {
    // Interrupt flag set; socket writes must not complete the parent queue.
    inv.assertWriterStopped(this.ctx);
  }

  async sendFrame(_frame: Buffer): Promise<void> {
    this._checkInvariant();
  }
}

export class WriterStopped extends WriterIgnored {
  onEntry(): void {
    this.ctx.postInterrupted();
    inv.assertWriterStopped(this.ctx);
  }
}

@ihsm.InitialState
export class WriterIdle extends WriterInitialized {
  protected override _checkInvariant(): void {
    // Ready for the next length-prefixed frame.
    inv.assertWriterIdle(this.ctx);
  }

  async sendFrame(frame: Buffer): Promise<void> {
    this._checkInvariant();
    this.hsm.transition(WriterSending);
    this.notify.doWriteFrame(frame);
  }
}

export class WriterSending extends WriterInitialized {
  protected override _checkInvariant(): void {
    // Awaiting socket.write completion for the current frame.
    inv.assertWriterSending(this.ctx);
  }

  async doWriteFrame(frame: Buffer): Promise<void> {
    this._checkInvariant();
    try {
      await this.hsm.port.write(frame);
      this.notify.onWriteComplete();
    } catch (err) {
      this.notify.onWriteFailed(err instanceof Error ? err.message : String(err));
    }
  }

  onWriteComplete(): void {
    this._checkInvariant();
    this.hsm.transition(WriterIdle);
    this.ctx.postWriteComplete();
  }

  onWriteFailed(message: string): void {
    this._checkInvariant();
    this.hsm.transition(WriterIdle);
    this.ctx.postWriteFailed(message);
  }
}

export function createWriterContext(
  connection?: CBCommandChannelActorRef | CBNotificationChannelActorRef,
): CBConnectionWriterContext {
  return new CBConnectionWriterContext(connection);
}

export { CBConnectionWriterTop };

ihsm.registerStateNames({ CBConnectionWriterTop });
ihsm.registerStateNames(self);
