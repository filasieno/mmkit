import * as ihsm from "ihsm";
import { encodeCbString, parseAnswerTerm } from "@mmkit/base";
import type { ParsedAnswer } from "@mmkit/base";
import type { CBAnswer } from "../../shared/CBServerDefs";
import { CBCommandChannelTop } from "./CBCommandChannelConfig";
import type { CBCommandChannelActorRef, CBCommandChannelPortHandle } from "./CBCommandChannelConfig";
import type { CommandPendingRequest } from "./CBCommandChannelContext";
import { CB_IPC_METHODS, isIpcTransportFailure, } from "../../shared/cbIpcCatalog";
import { cbTrace } from "../../shared/cbTrace";
import * as inv from "./CBCommandChannelInvariants";
import * as self from "./CBCommandChannelActor";

/** Command name plus the full argument set it was dispatched with — used in rejection errors. */
type RejectedCommand = { command: string; [arg: string]: unknown };

/**
 * Command TCP channel — state hierarchy (* = {@link ihsm.InitialState})
 *
 * ```text
 * CBCommandChannelTop
 * * CommandBootstrap
 *   * CommandConnecting
 * - CommandChannelBase
 * - CommandTransport
 *   - CommandSession
 *     * CommandIdle
 *     - RequestProcessing → Writing → Reading
 *   - CommandClosing
 * - CommandTerminal → CommandDetaching → CommandClosed | CommandBroken
 * ```
 *
 * Handler matrix: `docs/cbserver-actor-handler-matrix.md` § CBCommandChannelTop.
 * Invariant predicates: {@link CBCommandChannelInvariants}.
 */

@ihsm.InitialState
export class CommandBootstrap extends CBCommandChannelTop {
  /**
   * Spawn-time composite — {@link ihsm.InitialState} link from {@link CBCommandChannelTop}.
   * Shared channel handlers live here so {@link CommandConnecting} and {@link CommandChannelBase}
   * both inherit them.
   *
   * @see docs/cbserver-actor-handler-matrix.md § CBCommandChannelTop
   */
  protected override _checkInvariant(): void {
    // Leaf states assert; see class-level comment on {@link CommandChannelBase}.
  }

  async getRawClientId(): Promise<string> {
    return this.ctx.getRawClientId();
  }

  close(): void {
    this._checkInvariant();
    throw new Error("channel is not ready");
  }

  protected rejectCommand(details: RejectedCommand): void {
    throw new Error(`channel is not ready (cannot dispatch ${JSON.stringify(details)})`);
  }

  dispatchTell(frames: string): void {
    this.rejectCommand({ command: "tell", frames });
  }
  dispatchUntell(frames: string): void {
    this.rejectCommand({ command: "untell", frames });
  }
  dispatchRetell(untellFrames: string, tellFrames: string): void {
    this.rejectCommand({ command: "retell", untellFrames, tellFrames });
  }
  dispatchTellModel(...files: string[]): void {
    this.rejectCommand({ command: "tellModel", files });
  }
  dispatchAsk(query: string, queryFormat?: string, answerRep?: string, rollbackTime?: string): void {
    this.rejectCommand({ command: "ask", query, queryFormat, answerRep, rollbackTime });
  }
  dispatchHypoAsk( frames: string, query: string, queryFormat?: string, answerRep?: string, rollbackTime?: string ): void {
    this.rejectCommand({ command: "hypoAsk", frames, query, queryFormat, answerRep, rollbackTime });
  }
  dispatchLpicall(lpiCall: string): void {
    this.rejectCommand({ command: "lpicall", lpiCall });
  }
  dispatchProlog(statement: string): void {
    this.rejectCommand({ command: "prolog", statement });
  }
  dispatchWhy(): void {
    this.rejectCommand({ command: "why" });
  }
  dispatchCd(modulePath?: string): void {
    this.rejectCommand({ command: "cd", modulePath });
  }
  dispatchPwd(): void {
    this.rejectCommand({ command: "pwd" });
  }
  dispatchLm(modulePath?: string): void {
    this.rejectCommand({ command: "lm", modulePath });
  }
  dispatchLs(className?: string): void {
    this.rejectCommand({ command: "ls", className });
  }
  dispatchMkdir(moduleName: string): void {
    this.rejectCommand({ command: "mkdir", moduleName });
  }
  dispatchWho(): void {
    this.rejectCommand({ command: "who" });
  }
  dispatchSub(): void {
    this.rejectCommand({ command: "sub" });
  }
  dispatchShow(objectName: string): void {
    this.rejectCommand({ command: "show", objectName });
  }
  dispatchNextMessage(messageType?: string): void {
    this.rejectCommand({ command: "nextMessage", messageType });
  }
  dispatchStopServer(password = ""): void {
    this.rejectCommand({ command: "stopServer", password });
  }
  dispatchReportClients(): void {
    this.rejectCommand({ command: "reportClients" });
  }
  dispatchNotificationRequest(about: string, tool: string): void {
    this.rejectCommand({ command: "notificationRequest", about, tool });
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
    const reason: string = hadError ? "socket closed with error" : "socket closed";
    this.notifyNow.doBreakTransport(reason);
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
    this.hsm.transition(CommandBroken);
  }

  doFinalizeClose(): void {
    if (this.ctx.activeRequest !== undefined) {
      if (this.ctx.requestQueue[0] === this.ctx.activeRequest) {
        this.ctx.requestQueue.shift();
      }
      this.ctx.activeRequest = undefined;
      this.ctx.pendingFrame = undefined;
    }
    this.ctx.requestQueue.length = 0;
    this.hsm.port.destroy();
    this.ctx.beginDetachChildren();
    this.hsm.transition(CommandDetaching);
    this.notifyNow.doDispatchInterrupt();
  }
}

export class CommandChannelBase extends CommandBootstrap {
  protected override _checkInvariant(): void {
    // Leaf states assert; see CommandBootstrap class-level comment.
  }
}

@ihsm.InitialState
export class CommandConnecting extends CommandBootstrap {
  protected override _checkInvariant(): void {
    inv.assertCommandConnecting(this.ctx);
  }

  onEntry(): void {
    this.ctx.channelMailbox = (this.hsm.port as unknown as CBCommandChannelPortHandle).actor;
    this.notifyNow.doConnect();
    inv.assertCommandConnecting(this.ctx);
  }

  async doConnect(): Promise<void> {
    this._checkInvariant();
    try {
      await this.hsm.port.open();
      this.notifyNow.doSpawnTcpChildren();
    } catch (err) {
      this.notifyNow.doBreakTransport(err instanceof Error ? err.message : String(err));
    }
  }

  async doSpawnTcpChildren(): Promise<void> {
    this._checkInvariant();
    if (this.ctx.children !== undefined) {
      this.notifyNow.doBeginEnroll();
      return;
    }
    const channel: CBCommandChannelActorRef = this.ctx.channelMailbox!;
    this.ctx.children = await this.hsm.port.spawnTcpChildren(channel);
    this.notifyNow.doBeginEnroll();
  }

  doBeginEnroll(): void {
    this._checkInvariant();
    this.ctx.requestQueue.push(this.ctx.allocEnrollCommand());
    this.hsm.transition(RequestProcessing);
    this.notify.doProcessNext();
  }
}

export class CommandTransport extends CommandChannelBase {
  protected override _checkInvariant(): void {
    inv.assertCommandTransport(this.ctx);
  }

  protected dispatchIpc(method: string, data: string, client?: string, server?: string): void {
    this._checkInvariant();
    const waiter: { resolve(answer: CBAnswer): void; reject(error: Error): void } = this.ctx.consumePendingCommand();
    this.ctx.requestQueue.push({ method, data, client, server, resolve: waiter.resolve, reject: waiter.reject });
    if (this.hsm.currentState === CommandIdle) {
      this.hsm.transition(RequestProcessing);
    }
    this.notify.doProcessNext();
  }

  doProcessNext(): void {
    this._checkInvariant();
    if (this.ctx.requestQueue.length === 0) {
      if (this.ctx.closed) {
        this.notifyNow.doFinalizeClose();
        return;
      }
      this.hsm.transition(CommandIdle);
      return;
    }
    if (this.ctx.activeRequest !== undefined) {
      return;
    }
    this.ctx.activeRequest = this.ctx.requestQueue[0];
    const active: CommandPendingRequest | undefined = this.ctx.activeRequest;
    this.ctx.pendingFrame = this.ctx.buildIpcFrame(active.method, active.data, active.client, active.server);
    if (active.method === CB_IPC_METHODS.NOTIFICATION_REQUEST) {
      cbTrace( "ipc:NOTIFICATION_REQUEST:frame", { clientId: this.ctx.clientId, serverId: this.ctx.serverId, data: active.data, frame: this.ctx.pendingFrame.toString("utf8").replace(/\n/g, "\\n"), } );
    }
    this.hsm.transition(Writing);
    this.notify.doWriteActive();
  }

  async doWriteActive(): Promise<void> {
    this._checkInvariant();
    try {
      await this.ctx.children!.writer.call.sendFrame(this.ctx.pendingFrame!);
    } catch (err) {
      this.notify.doFailActive(err instanceof Error ? err.message : String(err));
    }
  }

  onWriterComplete(): void {
    this._checkInvariant();
    this.hsm.transition(Reading);
    this.notify.doReadActive();
  }

  onWriterFailed(message: string): void {
    this._checkInvariant();
    this.notify.doFailActive(message);
  }

  doReadActive(): void {
    this._checkInvariant();
    this.ctx.children!.reader.notify.beginAwait();
  }

  onReaderAnswer(answer: CBAnswer): void {
    this._checkInvariant();
    this.notify.doReadComplete(answer);
  }

  onReaderFailed(message: string): void {
    this._checkInvariant();
    this.notify.doFailActive(message);
  }

  onReaderNotification(answer: CBAnswer): void {
    this._checkInvariant();
    cbTrace("command-channel:ignored-notification", { completion: answer.completion });
  }

  doReadComplete(answer: CBAnswer): void {
    this._checkInvariant();
    if (isIpcTransportFailure(answer.completion)) {
      this.notify.doFailActive(answer.completion);
      return;
    }

    const active: CommandPendingRequest = this.ctx.activeRequest!;
    this.ctx.requestQueue.shift();
    this.ctx.activeRequest = undefined;
    this.ctx.pendingFrame = undefined;

    cbTrace(`ipc:${active.method}`, answer);

    if (active.method === CB_IPC_METHODS.ENROLL_ME) {
      if (!answer.ok) {
        active.reject(new Error(`ENROLL_ME failed: ${answer.result ?? answer.completion}`));
        this.notifyNow.doBreakTransport("enroll failed");
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
      active.resolve(answer);
      if (this.ctx.closed) {
        this.notifyNow.doFinalizeClose();
        return;
      }
      this.hsm.transition(CommandIdle);
      return;
    }

    if (active.method === CB_IPC_METHODS.CANCEL_ME) {
      active.resolve(answer);
      this.notifyNow.doFinalizeClose();
      return;
    }

    if (active.method === CB_IPC_METHODS.STOP_SERVER) {
      this.ctx.closed = true;
      active.resolve(answer);
      this.hsm.port.destroy();
      this.ctx.dispatchInterruptToChildren();
      this.ctx.children = undefined;
      this.ctx.awaitReaderInterrupted = false;
      this.ctx.awaitWriterInterrupted = false;
      this.ctx.onChannelClosed();
      this.hsm.transition(CommandClosed);
      return;
    }

    active.resolve(answer);
    if (this.ctx.closed) {
      this.notifyNow.doFinalizeClose();
      return;
    }
    if (this.ctx.requestQueue.length === 0) {
      this.hsm.transition(CommandIdle);
      return;
    }
    this.hsm.transition(RequestProcessing);
    this.notify.doProcessNext();
  }

  doFailActive(message: string): void {
    this._checkInvariant();
    const active: CommandPendingRequest | undefined = this.ctx.activeRequest ?? this.ctx.requestQueue.shift();
    if (this.ctx.activeRequest !== undefined) {
      this.ctx.requestQueue.shift();
    }
    this.ctx.activeRequest = undefined;
    this.ctx.pendingFrame = undefined;
    active?.reject(new Error(message));
    if (this.ctx.closed) {
      this.notifyNow.doFinalizeClose();
      return;
    }
    if (this.ctx.requestQueue.length === 0) {
      this.hsm.transition(CommandIdle);
      return;
    }
    this.hsm.transition(RequestProcessing);
    this.notify.doProcessNext();
  }
}

export class CommandSession extends CommandTransport {
  protected override _checkInvariant(): void {
    inv.assertCommandSession(this.ctx);
  }
}

@ihsm.InitialState
export class CommandIdle extends CommandSession {
  protected override _checkInvariant(): void {
    inv.assertCommandIdle(this.ctx);
  }

  onEntry(): void {
    this.ctx.bootstrapDone?.resolve();
    this.ctx.bootstrapDone = undefined;
    inv.assertCommandIdle(this.ctx);
  }

  close(): void {
    this._checkInvariant();
    this.ctx.closed = true;
    this.hsm.transition(CommandClosing);
  }

  dispatchTell(frames: string): void {
    this.dispatchIpc(CB_IPC_METHODS.TELL, encodeCbString(frames));
  }
  dispatchUntell(frames: string): void {
    this.dispatchIpc(CB_IPC_METHODS.UNTELL, encodeCbString(frames));
  }
  dispatchRetell(untellFrames: string, tellFrames: string): void {
    this.dispatchIpc(CB_IPC_METHODS.RETELL, `[${encodeCbString(untellFrames)},${encodeCbString(tellFrames)}]`,);
  }
  dispatchTellModel(...files: string[]): void {
    this.dispatchIpc(CB_IPC_METHODS.TELL_MODEL, `[${files.map((f) => encodeCbString(f)).join(",")}]`);
  }
  dispatchAsk(query: string, queryFormat = "OBJNAMES", answerRep = "default", rollbackTime = "Now"): void {
    this.dispatchIpc(CB_IPC_METHODS.ASK, `${queryFormat},${encodeCbString(query)},${encodeCbString(answerRep)},${encodeCbString(rollbackTime)}`,);
  }
  dispatchHypoAsk( frames: string, query: string, queryFormat = "ASK", answerRep = "default", rollbackTime = "Now" ): void {
    this.dispatchIpc( CB_IPC_METHODS.HYPO_ASK, [ encodeCbString(frames), queryFormat, encodeCbString(query), encodeCbString(answerRep), encodeCbString(rollbackTime), ].join(","), );
  }
  dispatchLpicall(lpiCall: string): void {
    this.dispatchIpc(CB_IPC_METHODS.LPI_CALL, encodeCbString(lpiCall));
  }
  dispatchProlog(statement: string): void {
    const goal: string = statement.trim().replace(/\.\s*$/, "");
    this.dispatchIpc(CB_IPC_METHODS.LPI_CALL, encodeCbString(`PROLOG_CALL,${goal}`));
  }
  dispatchWhy(): void {
    this.dispatchIpc(CB_IPC_METHODS.NEXT_MESSAGE, "ERROR_REPORT");
  }
  dispatchCd(modulePath?: string): void {
    if (modulePath === undefined || modulePath === "") {
      this.dispatchIpc(CB_IPC_METHODS.GET_MODULE_CONTEXT, "");
      return;
    }
    let quoted: string = modulePath;
    if (/(.*)-[0-9](.*)/.test(modulePath)) {
      quoted = `'${modulePath.replaceAll("-", "'-'")}'`;
    } else if (/(.*)\/[0-9](.*)/.test(modulePath)) {
      quoted = `'${modulePath.replaceAll("/", "'/'")}'`;
    }
    this.dispatchIpc(CB_IPC_METHODS.SET_MODULE_CONTEXT, encodeCbString(quoted));
  }
  dispatchPwd(): void {
    this.dispatchIpc(CB_IPC_METHODS.GET_MODULE_PATH, "");
  }
  dispatchLm(modulePath?: string): void {
    const query: string = modulePath === undefined || modulePath === "" ? "listModule" : `listModule[${modulePath}/module]`;
    this.dispatchAsk(query, "OBJNAMES", "FRAME", "Now");
  }
  dispatchLs(className?: string): void {
    const target: string = className === undefined || className === "" ? "Individual" : className;
    this.dispatchAsk(`find_instances[${target}/class]`, "OBJNAMES", "LABEL", "Now");
  }
  dispatchMkdir(moduleName: string): void {
    this.dispatchIpc(CB_IPC_METHODS.TELL, encodeCbString(`${moduleName} in Module end`));
  }
  dispatchWho(): void {
    this.dispatchAsk("find_instances[CB_User/class]", "OBJNAMES", "LABEL", "Now");
  }
  dispatchSub(): void {
    this.dispatchAsk("find_instances[Module/class]", "OBJNAMES", "LABEL", "Now");
  }
  dispatchShow(objectName: string): void {
    this.dispatchAsk(`get_object[${objectName}/objname]`, "OBJNAMES", "FRAME", "Now");
  }
  dispatchNextMessage(messageType?: string): void {
    this.dispatchIpc(CB_IPC_METHODS.NEXT_MESSAGE, messageType ?? "empty");
  }
  dispatchStopServer(password = ""): void {
    this.dispatchIpc(CB_IPC_METHODS.STOP_SERVER, password);
  }
  dispatchReportClients(): void {
    this.dispatchIpc(CB_IPC_METHODS.REPORT_CLIENTS, "");
  }
  dispatchNotificationRequest(about: string, tool: string): void {
    this.dispatchIpc(CB_IPC_METHODS.NOTIFICATION_REQUEST, `${encodeCbString(about)},${encodeCbString(tool)}`,);
  }
}

export class RequestProcessing extends CommandTransport {
  protected override _checkInvariant(): void {
    inv.assertRequestProcessing(this.ctx);
  }

  /**
   * Close requested while a command is in flight (e.g. server shutdown races the answer).
   * Defer it: mark `closed` and let the active request settle — `doReadComplete` /
   * `doFailActive` / `doProcessNext` then finalize instead of returning to CommandIdle.
   * Never throw here; a shutdown is a legitimate event, not a programming error.
   */
  close(): void {
    this._checkInvariant();
    this.ctx.closed = true;
  }
}

export class Writing extends RequestProcessing {
  protected override _checkInvariant(): void {
    inv.assertWriting(this.ctx);
  }
}

export class Reading extends RequestProcessing {
  protected override _checkInvariant(): void {
    inv.assertReading(this.ctx);
  }

  onSocketEnd(): void {
    this._checkInvariant();
    if (this.ctx.closed) {
      this.notifyNow.doFinalizeClose();
      return;
    }
    this.ctx.children!.reader.notify.onEnd();
  }

  onSocketClose(hadError: boolean): void {
    this._checkInvariant();
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

export class CommandClosing extends CommandTransport {
  protected override _checkInvariant(): void {
    inv.assertCommandClosing(this.ctx);
  }

  onEntry(): void {
    if (this.ctx.enrolled) {
      this.ctx.requestQueue.push( { method: CB_IPC_METHODS.CANCEL_ME, data: "", resolve: () => undefined, reject: () => undefined, } );
      this.hsm.transition(RequestProcessing);
      this.notify.doProcessNext();
      return;
    }
    this.notifyNow.doFinalizeClose();
  }

  close(): void {
    this._checkInvariant();
  }
}

export class CommandTerminal extends CommandChannelBase {
  protected override _checkInvariant(): void {
    inv.assertCommandTerminal(this.ctx);
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
  doBreakTransport(_message: string): void {
    this._checkInvariant();
  }
  doFinalizeClose(): void {
    this._checkInvariant();
  }
  doProcessNext(): void {
    this._checkInvariant();
  }
  doWriteActive(): void {
    this._checkInvariant();
  }
  doReadActive(): void {
    this._checkInvariant();
  }
  doReadComplete(_answer: CBAnswer): void {
    this._checkInvariant();
  }
  doFailActive(_message: string): void {
    this._checkInvariant();
  }
  close(): void {
    this._checkInvariant();
  }
}

export class CommandDetaching extends CommandTerminal {
  protected override _checkInvariant(): void {
    inv.assertCommandDetaching(this.ctx);
  }

  onEntry(): void {
    this.notify.doDispatchInterrupt();
    inv.assertCommandDetaching(this.ctx);
  }

  doDispatchInterrupt(): void {
    this.ctx.dispatchInterruptToChildren();
    inv.assertCommandDetachingAfterInterrupt(this.ctx);
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
    inv.assertCommandDetachingAfterInterrupt(this.ctx);
    if (!this.ctx.allInterrupted()) {
      return;
    }
    if (this.ctx.brokenReason !== undefined) {
      this.ctx.onChannelBroken(this.ctx.brokenReason);
      this.hsm.transition(CommandBroken);
      return;
    }
    this.ctx.onChannelClosed();
    this.hsm.transition(CommandClosed);
  }
}

export class CommandClosed extends CommandTerminal {
  protected override _checkInvariant(): void {
    inv.assertCommandClosed(this.ctx);
  }

  onEntry(): void {
    this.ctx.resolvePendingClose();
    inv.assertCommandClosed(this.ctx);
  }

  close(): void {
    this._checkInvariant();
  }

  rejectCommand(details: RejectedCommand): void {
    throw new Error(`channel is closed (cannot dispatch ${JSON.stringify(details)})`);
  }
}

export class CommandBroken extends CommandTerminal {
  protected override _checkInvariant(): void {
    inv.assertCommandBroken(this.ctx);
  }

  onEntry(): void {
    this.ctx.rejectPendingClose(new Error(this.ctx.brokenReason ?? "channel broken"));
    inv.assertCommandBroken(this.ctx);
  }

  close(): void {
    this._checkInvariant();
  }

  rejectCommand(details: RejectedCommand): void {
    throw new Error(`${this.ctx.brokenReason ?? "channel broken"} (cannot dispatch ${JSON.stringify(details)})`);
  }
}

ihsm.registerStateNames({ CBCommandChannelTop });
ihsm.registerStateNames(self);
