import * as ihsm from "ihsm";
import { encodeCbString, parseAnswerTerm } from "@mmkit/shared/dist/cb-tcp";
import type { CBAnswer } from "../../shared/CBServerDefs";
import { CBCommandChannelTop, type CBCommandChannelPortHandle } from "./CBCommandChannelConfig";
import type { CommandPendingRequest } from "./CBCommandChannelContext";
import {
  CB_IPC_METHODS,
  buildAskPayload,
  buildHypoAskPayload,
  buildLpiCallPayload,
  buildPrologCallPayload,
  buildMkdirPayload,
  buildNextMessagePayload,
  buildNotificationRequestPayload,
  buildRetellPayload,
  buildSetModuleContextPayload,
  buildTellModelPayload,
  buildTellPayload,
  buildUntellPayload,
  isIpcTransportFailure,
} from "../../shared/cbIpcCatalog";
import { cbTrace, cbTraceAnswer } from "../../shared/cbTrace";
import * as inv from "./CBCommandChannelInvariants";
import * as self from "./CBCommandChannelActor";

/**
 * Command TCP channel — state hierarchy (* = {@link ihsm.InitialState})
 *
 * ```text
 * CBCommandChannelTop
 * * CommandUninitialized
 * - CommandConnecting
 * - CommandTransport
 *   - CommandSession
 *     * CommandIdle
 *     - RequestProcessing → Writing → Reading
 *   - CommandClosing
 * - CommandTerminal → CommandDetaching → CommandClosed | CommandBroken
 * ```
 */

export class CommandChannelBase extends CBCommandChannelTop {
  protected override _checkInvariant(): void {}

  async getRawClientId(): Promise<string> {
    return this.ctx.getRawClientId();
  }

  close(): void {
    this._checkInvariant();
    throw new Error("channel is not ready");
  }

  rejectCommand(): void {
    throw new Error("channel is not ready");
  }

  dispatchTell(_frames: string): void {
    this.rejectCommand();
  }
  dispatchUntell(_frames: string): void {
    this.rejectCommand();
  }
  dispatchRetell(_untellFrames: string, _tellFrames: string): void {
    this.rejectCommand();
  }
  dispatchTellModel(..._files: string[]): void {
    this.rejectCommand();
  }
  dispatchAsk(_query: string, _queryFormat?: string, _answerRep?: string, _rollbackTime?: string): void {
    this.rejectCommand();
  }
  dispatchHypoAsk(
    _frames: string,
    _query: string,
    _queryFormat?: string,
    _answerRep?: string,
    _rollbackTime?: string,
  ): void {
    this.rejectCommand();
  }
  dispatchLpicall(_lpiCall: string): void {
    this.rejectCommand();
  }
  dispatchProlog(_statement: string): void {
    this.rejectCommand();
  }
  dispatchWhy(): void {
    this.rejectCommand();
  }
  dispatchCd(_modulePath?: string): void {
    this.rejectCommand();
  }
  dispatchPwd(): void {
    this.rejectCommand();
  }
  dispatchLm(_modulePath?: string): void {
    this.rejectCommand();
  }
  dispatchLs(_className?: string): void {
    this.rejectCommand();
  }
  dispatchMkdir(_moduleName: string): void {
    this.rejectCommand();
  }
  dispatchWho(): void {
    this.rejectCommand();
  }
  dispatchSub(): void {
    this.rejectCommand();
  }
  dispatchShow(_objectName: string): void {
    this.rejectCommand();
  }
  dispatchNextMessage(_messageType?: string): void {
    this.rejectCommand();
  }
  dispatchStopServer(_password = ""): void {
    this.rejectCommand();
  }
  dispatchReportClients(): void {
    this.rejectCommand();
  }
  dispatchNotificationRequest(_about: string, _tool: string): void {
    this.rejectCommand();
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
    const reason = hadError ? "socket closed with error" : "socket closed";
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

@ihsm.InitialState
export class CommandUninitialized extends CommandChannelBase {
  protected override _checkInvariant(): void {
    inv.assertCommandUninitialized(this.ctx);
  }

  async initialize(): Promise<void> {
    this._checkInvariant();
    this.ctx.channelMailbox = (this.hsm.port as unknown as CBCommandChannelPortHandle).actor;
    this.hsm.transition(CommandConnecting);
  }
}

export class CommandConnecting extends CommandChannelBase {
  protected override _checkInvariant(): void {
    inv.assertCommandConnecting(this.ctx);
  }

  onEntry(): void {
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
    const channel = this.ctx.channelMailbox!;
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
    const waiter = this.ctx.consumePendingCommand();
    this.ctx.requestQueue.push({ method, data, client, server, resolve: waiter.resolve, reject: waiter.reject });
    if (this.hsm.currentState === CommandIdle) {
      this.hsm.transition(RequestProcessing);
    }
    this.notify.doProcessNext();
  }

  doProcessNext(): void {
    this._checkInvariant();
    if (this.ctx.requestQueue.length === 0) {
      this.hsm.transition(CommandIdle);
      return;
    }
    if (this.ctx.activeRequest !== undefined) {
      return;
    }
    this.ctx.activeRequest = this.ctx.requestQueue[0];
    const active = this.ctx.activeRequest;
    this.ctx.pendingFrame = this.ctx.buildIpcFrame(active.method, active.data, active.client, active.server);
    if (active.method === CB_IPC_METHODS.NOTIFICATION_REQUEST) {
      cbTrace("ipc:NOTIFICATION_REQUEST:frame", {
        clientId: this.ctx.clientId,
        serverId: this.ctx.serverId,
        data: active.data,
        frame: this.ctx.pendingFrame.toString("utf8").replace(/\n/g, "\\n"),
      });
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

    const active = this.ctx.activeRequest!;
    this.ctx.requestQueue.shift();
    this.ctx.activeRequest = undefined;
    this.ctx.pendingFrame = undefined;

    cbTraceAnswer(`ipc:${active.method}`, answer);

    if (active.method === CB_IPC_METHODS.ENROLL_ME) {
      if (!answer.ok) {
        active.reject(new Error(`ENROLL_ME failed: ${answer.result ?? answer.completion}`));
        this.notifyNow.doBreakTransport("enroll failed");
        return;
      }
      this.ctx.enrolled = true;
      const parsed = parseAnswerTerm(answer.term);
      if (parsed.sender !== undefined && parsed.sender !== "") {
        this.ctx.serverId = encodeCbString(parsed.sender.trim());
      }
      const clientName = parsed.returnData ?? answer.result;
      if (clientName !== undefined) {
        this.ctx.clientId = encodeCbString(clientName);
      }
      active.resolve(answer);
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
    if (this.ctx.requestQueue.length === 0) {
      this.hsm.transition(CommandIdle);
      return;
    }
    this.hsm.transition(RequestProcessing);
    this.notify.doProcessNext();
  }

  doFailActive(message: string): void {
    this._checkInvariant();
    const active = this.ctx.activeRequest ?? this.ctx.requestQueue.shift();
    if (this.ctx.activeRequest !== undefined) {
      this.ctx.requestQueue.shift();
    }
    this.ctx.activeRequest = undefined;
    this.ctx.pendingFrame = undefined;
    active?.reject(new Error(message));
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
    this.dispatchIpc(CB_IPC_METHODS.TELL, buildTellPayload(frames));
  }
  dispatchUntell(frames: string): void {
    this.dispatchIpc(CB_IPC_METHODS.UNTELL, buildUntellPayload(frames));
  }
  dispatchRetell(untellFrames: string, tellFrames: string): void {
    this.dispatchIpc(CB_IPC_METHODS.RETELL, buildRetellPayload(untellFrames, tellFrames));
  }
  dispatchTellModel(...files: string[]): void {
    this.dispatchIpc(CB_IPC_METHODS.TELL_MODEL, buildTellModelPayload(files));
  }
  dispatchAsk(query: string, queryFormat?: string, answerRep?: string, rollbackTime?: string): void {
    this.dispatchIpc(CB_IPC_METHODS.ASK, buildAskPayload(query, queryFormat, answerRep, rollbackTime));
  }
  dispatchHypoAsk(frames: string, query: string, queryFormat?: string, answerRep?: string, rollbackTime?: string): void {
    this.dispatchIpc(CB_IPC_METHODS.HYPO_ASK, buildHypoAskPayload(frames, query, queryFormat, answerRep, rollbackTime));
  }
  dispatchLpicall(lpiCall: string): void {
    this.dispatchIpc(CB_IPC_METHODS.LPI_CALL, buildLpiCallPayload(lpiCall));
  }
  dispatchProlog(statement: string): void {
    this.dispatchIpc(CB_IPC_METHODS.LPI_CALL, buildPrologCallPayload(statement));
  }
  dispatchWhy(): void {
    this.dispatchIpc(CB_IPC_METHODS.NEXT_MESSAGE, buildNextMessagePayload("ERROR_REPORT"));
  }
  dispatchCd(modulePath?: string): void {
    if (modulePath === undefined || modulePath === "") {
      this.dispatchIpc(CB_IPC_METHODS.GET_MODULE_CONTEXT, "");
      return;
    }
    this.dispatchIpc(CB_IPC_METHODS.SET_MODULE_CONTEXT, buildSetModuleContextPayload(modulePath));
  }
  dispatchPwd(): void {
    this.dispatchIpc(CB_IPC_METHODS.GET_MODULE_PATH, "");
  }
  dispatchLm(modulePath?: string): void {
    const query = modulePath === undefined || modulePath === "" ? "listModule" : `listModule[${modulePath}/module]`;
    this.dispatchAsk(query, "OBJNAMES", "FRAME", "Now");
  }
  dispatchLs(className?: string): void {
    const target = className === undefined || className === "" ? "Individual" : className;
    this.dispatchAsk(`find_instances[${target}/class]`, "OBJNAMES", "LABEL", "Now");
  }
  dispatchMkdir(moduleName: string): void {
    this.dispatchIpc(CB_IPC_METHODS.TELL, buildMkdirPayload(moduleName));
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
    this.dispatchIpc(CB_IPC_METHODS.NEXT_MESSAGE, buildNextMessagePayload(messageType ?? "empty"));
  }
  dispatchStopServer(password = ""): void {
    this.dispatchIpc(CB_IPC_METHODS.STOP_SERVER, password);
  }
  dispatchReportClients(): void {
    this.dispatchIpc(CB_IPC_METHODS.REPORT_CLIENTS, "");
  }
  dispatchNotificationRequest(about: string, tool: string): void {
    this.dispatchIpc(CB_IPC_METHODS.NOTIFICATION_REQUEST, buildNotificationRequestPayload(about, tool));
  }
}

export class RequestProcessing extends CommandTransport {
  protected override _checkInvariant(): void {
    inv.assertRequestProcessing(this.ctx);
  }

  close(): void {
    this._checkInvariant();
    throw new Error("channel is busy");
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
      this.ctx.requestQueue.push({
        method: CB_IPC_METHODS.CANCEL_ME,
        data: "",
        resolve: () => undefined,
        reject: () => undefined,
      });
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

  rejectCommand(): void {
    throw new Error("channel is closed");
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

  rejectCommand(): void {
    throw new Error(this.ctx.brokenReason ?? "channel broken");
  }
}

ihsm.registerStateNames({ CBCommandChannelTop });
ihsm.registerStateNames(self);
