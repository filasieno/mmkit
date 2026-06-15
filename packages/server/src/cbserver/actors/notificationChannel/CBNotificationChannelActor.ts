import * as ihsm from "ihsm";
import { encodeCbString, parseAnswerTerm } from "@mmkit/base";
import type { ParsedAnswer } from "@mmkit/base";
import type { CBAnswer } from "../../shared/CBServerDefs";
import { CBNotificationChannelTop } from "./CBNotificationChannelConfig";
import type { CBNotificationChannelActorRef, CBNotificationChannelPortHandle } from "./CBNotificationChannelConfig";
import type { NotificationEnrollRequest } from "./CBNotificationChannelContext";
import { CB_IPC_COMPLETIONS, CB_IPC_METHODS, isIpcTransportFailure, } from "../../shared/cbIpcCatalog";
import { cbTrace } from "../../shared/cbTrace";
import * as inv from "./CBNotificationChannelInvariants";
import * as self from "./CBNotificationChannelActor";

/**
 * Notification TCP channel — dedicated socket for server push (Java {@code CBNotificationConnection}).
 *
 * ```text
 * CBNotificationChannelTop
 * * NotificationUninitialized
 * - NotificationConnecting
 * - NotificationTransport
 *   * NotificationIdle
 *   - NotificationAwaiting
 *   - NotificationClosing
 * - NotificationTerminal → NotificationDetaching → NotificationClosed | NotificationBroken
 * ```
 */

@ihsm.InitialState
export class NotificationUninitialized extends CBNotificationChannelTop {
  protected override _checkInvariant(): void {
    inv.assertNotificationUninitialized(this.ctx);
  }

  async initialize(): Promise<void> {
    this._checkInvariant();
    this.ctx.channelMailbox = (this.hsm.port as unknown as CBNotificationChannelPortHandle).actor;
    this.hsm.transition(NotificationConnecting);
  }
}

export class NotificationChannelBase extends CBNotificationChannelTop {
  protected override _checkInvariant(): void {}

  protected clearNotificationReadTimer(): void {
    if (this.ctx.notificationReadTimer !== undefined) {
      this.hsm.port.clearTimeout(this.ctx.notificationReadTimer);
      this.ctx.notificationReadTimer = undefined;
    }
  }

  async getRawClientId(): Promise<string> {
    return this.ctx.getRawClientId();
  }

  close(): void {
    this._checkInvariant();
    throw new Error("notification channel is not ready");
  }

  beginGetNotification(_timeoutMs?: number): void {
    this._checkInvariant();
    throw new Error("notification channel is not ready");
  }

  onSocketConnect(): void {
    this._checkInvariant();
  }
  onSocketData(chunk: string): void {
    this._checkInvariant();
    this.ctx.children?.reader.notify.onData(chunk);
  }
  onSocketDrain(): void {
    this._checkInvariant();
  }
  onSocketEnd(): void {
    this._checkInvariant();
    if (this.ctx.closed) {
      this.notifyNow.doFinalizeClose();
      return;
    }
    this.notifyNow.doBreakTransport("socket ended");
  }
  onSocketClose(hadError: boolean): void {
    this._checkInvariant();
    if (this.ctx.closed) {
      this.notifyNow.doFinalizeClose();
      return;
    }
    this.notifyNow.doBreakTransport(hadError ? "socket closed with error" : "socket closed");
  }
  onSocketError(errorMessage: string): void {
    this._checkInvariant();
    this.notifyNow.doBreakTransport(errorMessage);
  }
  onSocketTimeout(): void {
    this._checkInvariant();
    this.notifyNow.doBreakTransport("socket timeout");
  }

  doBreakTransport(message: string): void {
    this.ctx.brokenReason = message;
    this.ctx.closed = true;
    this.ctx.rejectAllPending(message);
    this.ctx.bootstrapDone?.reject(new Error(message));
    this.ctx.bootstrapDone = undefined;
    this.hsm.port.destroy();
    this.ctx.dispatchInterruptToChildren();
    this.ctx.children = undefined;
    this.ctx.awaitReaderInterrupted = false;
    this.ctx.awaitWriterInterrupted = false;
    this.ctx.onChannelBroken(message);
    this.hsm.transition(NotificationBroken);
  }

  doFinalizeClose(): void {
    this.hsm.port.destroy();
    this.ctx.dispatchInterruptToChildren();
    this.ctx.children = undefined;
    this.ctx.awaitReaderInterrupted = false;
    this.ctx.awaitWriterInterrupted = false;
    this.ctx.onChannelClosed();
    this.hsm.transition(NotificationClosed);
  }
}

export class NotificationConnecting extends NotificationChannelBase {
  protected override _checkInvariant(): void {
    inv.assertNotificationConnecting(this.ctx);
  }

  onEntry(): void {
    this.notifyNow.doConnect();
  }

  async doConnect(): Promise<void> {
    try {
      await this.hsm.port.open();
      this.notifyNow.doSpawnTcpChildren();
    } catch (err) {
      this.notifyNow.doBreakTransport(err instanceof Error ? err.message : String(err));
    }
  }

  async doSpawnTcpChildren(): Promise<void> {
    const channel: CBNotificationChannelActorRef = this.ctx.channelMailbox!;
    this.ctx.children = await this.hsm.port.spawnTcpChildren(channel);
    this.notifyNow.doBeginEnroll();
  }

  doBeginEnroll(): void {
    this.ctx.requestQueue.push(this.ctx.allocEnrollCommand());
    this.hsm.transition(NotificationEnrolling);
    this.notify.doWriteEnroll();
  }
}

export class NotificationTransport extends NotificationChannelBase {
  protected override _checkInvariant(): void {
    inv.assertNotificationTransport(this.ctx);
  }

  async doWriteEnroll(): Promise<void> {
    const enroll: NotificationEnrollRequest | undefined = this.ctx.requestQueue[0];
    if (enroll === undefined) {
      return;
    }
    this.ctx.activeRequest = enroll;
    this.ctx.pendingFrame = this.ctx.buildIpcFrame(enroll.method, enroll.data, enroll.client, enroll.server);
    try {
      await this.ctx.children!.writer.call.sendFrame(this.ctx.pendingFrame);
    } catch (err) {
      this.notify.doFailEnroll(err instanceof Error ? err.message : String(err));
    }
  }

  onWriterComplete(): void {
    this.hsm.transition(NotificationEnrollReading);
    this.ctx.children!.reader.notify.beginAwait();
  }

  onWriterFailed(message: string): void {
    this.notify.doFailEnroll(message);
  }

  onReaderAnswer(answer: CBAnswer): void {
    this.notify.doCompleteEnroll(answer);
  }

  onReaderFailed(message: string): void {
    this.notify.doFailEnroll(message);
  }

  onReaderNotification(answer: CBAnswer): void {
    this.ctx.notificationQueue.push(answer);
    this.notifyNow.onNotificationReady(answer);
  }

  doCompleteEnroll(answer: CBAnswer): void {
    if (isIpcTransportFailure(answer.completion) || !answer.ok) {
      this.notify.doFailEnroll(answer.result ?? answer.completion);
      return;
    }
    this.ctx.enrolled = true;
    const parsed: ParsedAnswer = parseAnswerTerm(answer.term);
    if (parsed.sender !== undefined && parsed.sender !== "") {
      this.ctx.serverId = encodeCbString(parsed.sender.trim());
    }
    const clientName: string | undefined = parsed.returnData ?? answer.result;
    if (clientName !== undefined) {
      this.ctx.clientId = encodeCbString(clientName);
    }
    this.ctx.requestQueue.shift();
    this.ctx.activeRequest = undefined;
    this.ctx.pendingFrame = undefined;
    this.hsm.transition(NotificationIdle);
  }

  doFailEnroll(message: string): void {
    this.ctx.bootstrapDone?.reject(new Error(message));
    this.ctx.bootstrapDone = undefined;
    this.notifyNow.doBreakTransport(message);
  }
}

export class NotificationEnrolling extends NotificationTransport {
  protected override _checkInvariant(): void {
    inv.assertNotificationTransport(this.ctx);
  }
}

export class NotificationEnrollReading extends NotificationTransport {
  protected override _checkInvariant(): void {
    inv.assertNotificationTransport(this.ctx);
  }

  onSocketEnd(): void {
    if (this.ctx.closed) {
      this.notifyNow.doFinalizeClose();
      return;
    }
    this.ctx.children!.reader.notify.onEnd();
  }

  onSocketClose(hadError: boolean): void {
    if (this.ctx.closed) {
      this.notifyNow.doFinalizeClose();
      return;
    }
    if (hadError) {
      this.notifyNow.doBreakTransport("socket closed with error");
      return;
    }
    this.ctx.children!.reader.notify.onEnd();
  }
}

export class NotificationSession extends NotificationTransport {
  protected override _checkInvariant(): void {
    inv.assertNotificationSession(this.ctx);
  }

  /**
   * Absorb the reader/writer interrupt acknowledgement while the channel is
   * still in a live session state. {@link NotificationAwaiting.doNotificationReadTimeout}
   * interrupts the blocked notification reader on a getNotification timeout and
   * then returns to {@link NotificationIdle}; the resulting `onReaderInterrupted`
   * ack must be noted here instead of bubbling up as an unhandled event
   * (which previously surfaced as a FatalErrorState during teardown).
   */
  onReaderInterrupted(): void {
    this.ctx.noteReaderInterrupted();
  }

  onWriterInterrupted(): void {
    this.ctx.noteWriterInterrupted();
  }
}

export class NotificationIdle extends NotificationSession {
  protected override _checkInvariant(): void {
    inv.assertNotificationIdle(this.ctx);
  }

  onEntry(): void {
    this.ctx.bootstrapDone?.resolve();
    this.ctx.bootstrapDone = undefined;
    inv.assertNotificationIdle(this.ctx);
  }

  close(): void {
    this.ctx.closed = true;
    this.hsm.transition(NotificationClosing);
  }

  beginGetNotification(timeoutMs?: number): void {
    if (this.ctx.pendingNotification === undefined) {
      throw new Error("no pending notification waiter");
    }
    const queued: CBAnswer | undefined = this.ctx.notificationQueue.shift();
    if (queued !== undefined) {
      this.clearNotificationReadTimer();
      const waiter: { resolve(answer: CBAnswer): void; reject(error: Error): void } = this.ctx.consumePendingNotification();
      cbTrace("notification:dequeued", queued);
      waiter.resolve(queued);
      return;
    }
    this.clearNotificationReadTimer();
    if (timeoutMs !== undefined && timeoutMs > 0) {
      this.ctx.notificationReadTimer = this.hsm.port.setTimeout( () => { this.ctx.notificationReadTimer = undefined; this.notify.doNotificationReadTimeout(); }, timeoutMs );
    }
    this.hsm.transition(NotificationAwaiting);
    this.ctx.children!.reader.notify.beginAwait();
  }

  onNotificationReady(answer: CBAnswer): void {
    if (this.ctx.pendingNotification === undefined) {
      this.ctx.notificationQueue.push(answer);
      return;
    }
    const waiter: { resolve(answer: CBAnswer): void; reject(error: Error): void } = this.ctx.consumePendingNotification();
    cbTrace("notification:push", answer);
    waiter.resolve(answer);
  }
}

export class NotificationAwaiting extends NotificationSession {
  protected override _checkInvariant(): void {
    inv.assertNotificationAwaiting(this.ctx);
  }

  doNotificationReadTimeout(): void {
    this._checkInvariant();
    this.clearNotificationReadTimer();
    const waiter: { resolve(answer: CBAnswer): void; reject(error: Error): void } | undefined = this.ctx.pendingNotification;
    if (waiter === undefined) {
      return;
    }
    this.ctx.pendingNotification = undefined;
    try {
      this.ctx.children?.reader.notify.interrupt();
    } catch {
      // reader may already be idle
    }
    waiter.resolve( { ok: false, completion: CB_IPC_COMPLETIONS.TIMEOUT, result: "timeout", term: 'ipcanswer("",timeout,"timeout").', } );
    this.hsm.transition(NotificationIdle);
  }

  onReaderAnswer(answer: CBAnswer): void {
    this.clearNotificationReadTimer();
    const waiter: { resolve(answer: CBAnswer): void; reject(error: Error): void } = this.ctx.consumePendingNotification();
    cbTrace("notification:read", answer);
    waiter.resolve(answer);
    this.hsm.transition(NotificationIdle);
  }

  onReaderNotification(answer: CBAnswer): void {
    this.clearNotificationReadTimer();
    const waiter: { resolve(answer: CBAnswer): void; reject(error: Error): void } = this.ctx.consumePendingNotification();
    cbTrace("notification:push", answer);
    waiter.resolve(answer);
    this.hsm.transition(NotificationIdle);
  }

  onReaderFailed(message: string): void {
    this.clearNotificationReadTimer();
    const waiter: { resolve(answer: CBAnswer): void; reject(error: Error): void } | undefined = this.ctx.pendingNotification;
    if (waiter !== undefined) {
      this.ctx.pendingNotification = undefined;
      waiter.reject(new Error(message));
    }
    this.notifyNow.doBreakTransport(message);
  }

  onSocketEnd(): void {
    if (this.ctx.closed) {
      this.notifyNow.doFinalizeClose();
      return;
    }
    this.ctx.children!.reader.notify.onEnd();
  }

  onSocketClose(hadError: boolean): void {
    if (this.ctx.closed) {
      this.notifyNow.doFinalizeClose();
      return;
    }
    if (hadError) {
      this.notifyNow.doBreakTransport("socket closed with error");
      return;
    }
    this.ctx.children!.reader.notify.onEnd();
  }

  close(): void {
    throw new Error("notification channel is awaiting a message");
  }
}

export class NotificationClosing extends NotificationTransport {
  protected override _checkInvariant(): void {
    inv.assertNotificationClosing(this.ctx);
  }

  onEntry(): void {
    this.ctx.closed = true;
    if (this.ctx.enrolled) {
      this.ctx.pendingFrame = this.ctx.buildIpcFrame(CB_IPC_METHODS.CANCEL_ME, "");
      this.notify.doWriteCancel();
      return;
    }
    this.notifyNow.doFinalizeClose();
  }

  async doWriteCancel(): Promise<void> {
    try {
      await this.ctx.children!.writer.call.sendFrame(this.ctx.pendingFrame!);
    } catch {
      this.notifyNow.doFinalizeClose();
    }
  }

  onWriterComplete(): void {
    this.ctx.children!.reader.notify.beginAwait();
  }

  onReaderAnswer(_answer: CBAnswer): void {
    this.notifyNow.doFinalizeClose();
  }

  onReaderFailed(): void {
    this.notifyNow.doFinalizeClose();
  }

  close(): void {
    this._checkInvariant();
  }
}

export class NotificationTerminal extends NotificationChannelBase {
  protected override _checkInvariant(): void {
    inv.assertNotificationTerminal(this.ctx);
  }

  onSocketConnect(): void {
    this._checkInvariant();
  }
  onSocketData(_chunk: string): void {
    this._checkInvariant();
  }
  onSocketDrain(): void {
    this._checkInvariant();
  }
  onSocketEnd(): void {
    this._checkInvariant();
  }
  onSocketClose(_hadError: boolean): void {
    this._checkInvariant();
  }
  onSocketError(_errorMessage: string): void {
    this._checkInvariant();
  }
  onSocketTimeout(): void {
    this._checkInvariant();
  }
  onWriterComplete(): void {
    this._checkInvariant();
  }
  onWriterFailed(_message: string): void {
    this._checkInvariant();
  }
  onReaderAnswer(_answer: CBAnswer): void {
    this._checkInvariant();
  }
  onReaderFailed(_message: string): void {
    this._checkInvariant();
  }
  onReaderNotification(_answer: CBAnswer): void {
    this._checkInvariant();
  }
  onNotificationReady(_answer: CBAnswer): void {
    this._checkInvariant();
  }
  doBreakTransport(_message: string): void {
    this._checkInvariant();
  }
  doFinalizeClose(): void {
    this._checkInvariant();
  }
  doDispatchInterrupt(): void {
    this._checkInvariant();
  }
  doFinalizeDetach(): void {
    this._checkInvariant();
  }
  close(): void {
    this._checkInvariant();
  }
  beginGetNotification(_timeoutMs?: number): void {
    this._checkInvariant();
  }
}

export class NotificationDetaching extends NotificationTerminal {
  protected override _checkInvariant(): void {
    inv.assertNotificationDetaching(this.ctx);
  }

  onEntry(): void {
    this.notify.doDispatchInterrupt();
  }

  doDispatchInterrupt(): void {
    this.ctx.dispatchInterruptToChildren();
    this.notifyNow.doFinalizeDetach();
  }

  onReaderInterrupted(): void {
    this.ctx.noteReaderInterrupted();
    this.notifyNow.doFinalizeDetach();
  }

  onWriterInterrupted(): void {
    this.ctx.noteWriterInterrupted();
    this.notifyNow.doFinalizeDetach();
  }

  doFinalizeDetach(): void {
    if (!this.ctx.allInterrupted()) {
      return;
    }
    if (this.ctx.brokenReason !== undefined) {
      this.ctx.onChannelBroken(this.ctx.brokenReason);
      this.hsm.transition(NotificationBroken);
      return;
    }
    this.ctx.onChannelClosed();
    this.hsm.transition(NotificationClosed);
  }
}

export class NotificationClosed extends NotificationTerminal {
  protected override _checkInvariant(): void {
    inv.assertNotificationClosed(this.ctx);
  }

  onEntry(): void {
    this.ctx.resolvePendingClose();
  }

  beginGetNotification(): void {
    throw new Error("notification channel is closed");
  }
}

export class NotificationBroken extends NotificationTerminal {
  protected override _checkInvariant(): void {
    inv.assertNotificationBroken(this.ctx);
  }

  onEntry(): void {
    this.ctx.rejectPendingClose(new Error(this.ctx.brokenReason ?? "notification channel broken"));
  }

  beginGetNotification(): void {
    throw new Error(this.ctx.brokenReason ?? "notification channel broken");
  }
}

ihsm.registerStateNames({ CBNotificationChannelTop });
ihsm.registerStateNames(self);
