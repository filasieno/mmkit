import * as ihsm from "ihsm";
import { encodeCbString } from "@mmkit/shared/dist/cb-tcp";
import type { CBAnswer } from "../../shared/CBServerDefs";
import { CBConnectionTop, type CBConnectionActorRef } from "./CBServerConnectionConfig";
import {
  CBCommandChannelContext,
  waitForCommandChannelBootstrap,
  waitForCommandChannelAnswer,
} from "../commandChannel/CBCommandChannelContext";
import {
  CBNotificationChannelContext,
  waitForNotificationChannelBootstrap,
  waitForNotificationChannelAnswer,
} from "../notificationChannel/CBNotificationChannelContext";
import { CBCommandChannelPort } from "../commandChannel/CBCommandChannelPort";
import { CBNotificationChannelPort } from "../notificationChannel/CBNotificationChannelPort";
import { cbTrace } from "../../shared/cbTrace";
import * as inv from "./CBServerConnectionInvariants";
import * as self from "./CBServerConnectionActor";

/**
 * CBConnection orchestrator — dual TCP channels (Java CBConnection + CBNotificationConnection).
 *
 * ```text
 * CBConnectionTop
 * * ConnectionUninitialized
 * - Connecting
 * * ConnectionIdle
 * - ConnectionClosing
 * - ConnectionTerminal
 *   - ConnectionClosed
 *   - ConnectionBroken
 * ```
 */

export class ConnectionBase extends CBConnectionTop {
  protected override _checkInvariant(): void {}

  async getConnectionId(): Promise<string> {
    return this.ctx.connectionId;
  }

  async getClientId(): Promise<string> {
    if (this.ctx.commandCtx === undefined) {
      throw new Error("command channel is not ready");
    }
    return this.ctx.commandCtx.getRawClientId();
  }

  async getNotificationClientId(): Promise<string> {
    if (this.ctx.notificationCtx === undefined) {
      throw new Error("notification channel is not ready");
    }
    return this.ctx.notificationCtx.getRawClientId();
  }

  close(): void {
    this._checkInvariant();
    throw new Error("connection is not ready");
  }

  rejectCommand(): void {
    throw new Error("connection is not ready");
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
  dispatchNotificationRequest(_about: string, _tool?: string): void {
    this.rejectCommand();
  }
  dispatchGetNotificationMessage(_timeoutMs?: number): void {
    this.rejectCommand();
  }

  doBreakTransport(message: string): void {
    this.ctx.brokenReason = message;
    this.ctx.closed = true;
    this.ctx.rejectAllPending(message);
    this.ctx.bootstrapDone?.reject(new Error(message));
    this.ctx.bootstrapDone = undefined;
    this.ctx.commandChannel?.notify.close();
    this.ctx.notificationChannel?.notify.close();
    this.hsm.transition(ConnectionBroken);
  }

  doFinalizeClose(): void {
    if (!this.ctx.bothChannelsClosed()) {
      return;
    }
    this.ctx.onClose();
    if (this.ctx.brokenReason !== undefined) {
      this.hsm.transition(ConnectionBroken);
      return;
    }
    this.hsm.transition(ConnectionClosed);
  }

  onCommandChannelClosed(): void {
    this.ctx.noteCommandChannelClosed();
    if (this.ctx.closed && !this.ctx.notificationChannelClosed) {
      this.ctx.notificationChannel?.notify.close();
      return;
    }
    this.notifyNow.doFinalizeClose();
  }

  onNotificationChannelClosed(): void {
    this.ctx.noteNotificationChannelClosed();
    this.notifyNow.doFinalizeClose();
  }

  onCommandChannelBroken(message: string): void {
    this.ctx.brokenReason = message;
    this.ctx.closed = true;
    this.ctx.commandChannelClosed = true;
    this.ctx.rejectAllPending(message);
    this.ctx.notificationChannel?.notify.close();
    this.hsm.transition(ConnectionBroken);
  }

  onNotificationChannelBroken(message: string): void {
    this.ctx.brokenReason = message;
    this.ctx.closed = true;
    this.ctx.notificationChannelClosed = true;
    this.ctx.rejectAllPending(message);
    this.ctx.commandChannel?.notify.close();
    this.hsm.transition(ConnectionBroken);
  }
}

@ihsm.InitialState
export class ConnectionUninitialized extends ConnectionBase {
  protected override _checkInvariant(): void {
    inv.assertConnectionUninitialized(this.ctx);
  }

  async initialize(): Promise<void> {
    this._checkInvariant();
    this.hsm.transition(Connecting);
  }
}

export class Connecting extends ConnectionBase {
  protected override _checkInvariant(): void {
    inv.assertConnecting(this.ctx);
  }

  onEntry(): void {
    this.ctx.orchestratorMailbox = (this.hsm.port as unknown as { actor: CBConnectionActorRef }).actor;
    this.notifyNow.doSpawnChannels();
  }

  async doSpawnChannels(): Promise<void> {
    this._checkInvariant();
    const orchestrator = this.ctx.orchestratorMailbox!;
    const baseTool = this.ctx.tcp.toolName ?? "mmkit";

    const commandCtx = new CBCommandChannelContext(
      `${this.ctx.connectionId}:cmd`,
      () => orchestrator.notify.onCommandChannelClosed(),
      (message) => orchestrator.notify.onCommandChannelBroken(message),
      { ...this.ctx.tcp, toolName: baseTool },
    );
    const notificationCtx = new CBNotificationChannelContext(
      `${this.ctx.connectionId}:notif`,
      () => orchestrator.notify.onNotificationChannelClosed(),
      (message) => orchestrator.notify.onNotificationChannelBroken(message),
      {
        ...this.ctx.tcp,
        toolName: `${baseTool}-notify`,
        socketTimeoutMs: 0,
      },
    );
    this.ctx.commandCtx = commandCtx;
    this.ctx.notificationCtx = notificationCtx;

    const commandPort = (this.ctx.channelPorts?.command ?? new CBCommandChannelPort(commandCtx.tcp)) as never;
    const notificationPort = (this.ctx.channelPorts?.notification ?? new CBNotificationChannelPort(notificationCtx.tcp)) as never;

    const commandBootstrap = waitForCommandChannelBootstrap(commandCtx);
    const notificationBootstrap = waitForNotificationChannelBootstrap(notificationCtx);

    cbTrace("orchestrator:spawn-channels", { connectionId: this.ctx.connectionId });

    try {
      const commandChannel = await this.hsm.port.spawnCommandChannel(orchestrator, commandCtx, commandPort);
      this.ctx.commandChannel = commandChannel;
      await commandBootstrap;

      const notificationChannel = await this.hsm.port.spawnNotificationChannel(orchestrator, notificationCtx, notificationPort);
      this.ctx.notificationChannel = notificationChannel;
      await notificationBootstrap;

      this.ctx.bootstrapDone?.resolve();
      this.ctx.bootstrapDone = undefined;
      this.hsm.transition(ConnectionIdle);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.notifyNow.doBreakTransport(message);
    }
  }
}

export class ConnectionIdle extends ConnectionBase {
  protected override _checkInvariant(): void {
    inv.assertConnectionIdle(this.ctx);
  }

  close(): void {
    this._checkInvariant();
    this.ctx.closed = true;
    this.hsm.transition(ConnectionClosing);
  }

  private bridgeCommandAnswer(channelAnswer: Promise<CBAnswer>): void {
    const waiter = this.ctx.pendingCommand!;
    void channelAnswer.then(
      (answer) => {
        waiter.resolve(answer);
        this.ctx.pendingCommand = undefined;
        if (this.ctx.closed && !this.ctx.notificationChannelClosed) {
          this.ctx.notificationChannel?.notify.close();
        }
      },
      (err: Error) => {
        waiter.reject(err);
        this.ctx.pendingCommand = undefined;
      },
    );
  }

  dispatchTell(frames: string): void {
    if (this.ctx.pendingCommand === undefined) {
      throw new Error("no pending command waiter");
    }
    const answer = waitForCommandChannelAnswer(this.ctx.commandCtx!);
    this.ctx.commandChannel!.notify.dispatchTell(frames);
    this.bridgeCommandAnswer(answer);
  }

  dispatchUntell(frames: string): void {
    if (this.ctx.pendingCommand === undefined) {
      throw new Error("no pending command waiter");
    }
    const answer = waitForCommandChannelAnswer(this.ctx.commandCtx!);
    this.ctx.commandChannel!.notify.dispatchUntell(frames);
    this.bridgeCommandAnswer(answer);
  }

  dispatchRetell(untellFrames: string, tellFrames: string): void {
    if (this.ctx.pendingCommand === undefined) {
      throw new Error("no pending command waiter");
    }
    const answer = waitForCommandChannelAnswer(this.ctx.commandCtx!);
    this.ctx.commandChannel!.notify.dispatchRetell(untellFrames, tellFrames);
    this.bridgeCommandAnswer(answer);
  }

  dispatchTellModel(...files: string[]): void {
    if (this.ctx.pendingCommand === undefined) {
      throw new Error("no pending command waiter");
    }
    const answer = waitForCommandChannelAnswer(this.ctx.commandCtx!);
    this.ctx.commandChannel!.notify.dispatchTellModel(...files);
    this.bridgeCommandAnswer(answer);
  }

  dispatchAsk(query: string, queryFormat?: string, answerRep?: string, rollbackTime?: string): void {
    if (this.ctx.pendingCommand === undefined) {
      throw new Error("no pending command waiter");
    }
    const answer = waitForCommandChannelAnswer(this.ctx.commandCtx!);
    this.ctx.commandChannel!.notify.dispatchAsk(query, queryFormat, answerRep, rollbackTime);
    this.bridgeCommandAnswer(answer);
  }

  dispatchHypoAsk(frames: string, query: string, queryFormat?: string, answerRep?: string, rollbackTime?: string): void {
    if (this.ctx.pendingCommand === undefined) {
      throw new Error("no pending command waiter");
    }
    const answer = waitForCommandChannelAnswer(this.ctx.commandCtx!);
    this.ctx.commandChannel!.notify.dispatchHypoAsk(frames, query, queryFormat, answerRep, rollbackTime);
    this.bridgeCommandAnswer(answer);
  }

  dispatchLpicall(lpiCall: string): void {
    if (this.ctx.pendingCommand === undefined) {
      throw new Error("no pending command waiter");
    }
    const answer = waitForCommandChannelAnswer(this.ctx.commandCtx!);
    this.ctx.commandChannel!.notify.dispatchLpicall(lpiCall);
    this.bridgeCommandAnswer(answer);
  }

  dispatchProlog(statement: string): void {
    if (this.ctx.pendingCommand === undefined) {
      throw new Error("no pending command waiter");
    }
    const answer = waitForCommandChannelAnswer(this.ctx.commandCtx!);
    this.ctx.commandChannel!.notify.dispatchProlog(statement);
    this.bridgeCommandAnswer(answer);
  }

  dispatchWhy(): void {
    if (this.ctx.pendingCommand === undefined) {
      throw new Error("no pending command waiter");
    }
    const answer = waitForCommandChannelAnswer(this.ctx.commandCtx!);
    this.ctx.commandChannel!.notify.dispatchWhy();
    this.bridgeCommandAnswer(answer);
  }

  dispatchCd(modulePath?: string): void {
    if (this.ctx.pendingCommand === undefined) {
      throw new Error("no pending command waiter");
    }
    const answer = waitForCommandChannelAnswer(this.ctx.commandCtx!);
    this.ctx.commandChannel!.notify.dispatchCd(modulePath);
    this.bridgeCommandAnswer(answer);
  }

  dispatchPwd(): void {
    if (this.ctx.pendingCommand === undefined) {
      throw new Error("no pending command waiter");
    }
    const answer = waitForCommandChannelAnswer(this.ctx.commandCtx!);
    this.ctx.commandChannel!.notify.dispatchPwd();
    this.bridgeCommandAnswer(answer);
  }

  dispatchLm(modulePath?: string): void {
    if (this.ctx.pendingCommand === undefined) {
      throw new Error("no pending command waiter");
    }
    const answer = waitForCommandChannelAnswer(this.ctx.commandCtx!);
    this.ctx.commandChannel!.notify.dispatchLm(modulePath);
    this.bridgeCommandAnswer(answer);
  }

  dispatchLs(className?: string): void {
    if (this.ctx.pendingCommand === undefined) {
      throw new Error("no pending command waiter");
    }
    const answer = waitForCommandChannelAnswer(this.ctx.commandCtx!);
    this.ctx.commandChannel!.notify.dispatchLs(className);
    this.bridgeCommandAnswer(answer);
  }

  dispatchMkdir(moduleName: string): void {
    if (this.ctx.pendingCommand === undefined) {
      throw new Error("no pending command waiter");
    }
    const answer = waitForCommandChannelAnswer(this.ctx.commandCtx!);
    this.ctx.commandChannel!.notify.dispatchMkdir(moduleName);
    this.bridgeCommandAnswer(answer);
  }

  dispatchWho(): void {
    if (this.ctx.pendingCommand === undefined) {
      throw new Error("no pending command waiter");
    }
    const answer = waitForCommandChannelAnswer(this.ctx.commandCtx!);
    this.ctx.commandChannel!.notify.dispatchWho();
    this.bridgeCommandAnswer(answer);
  }

  dispatchSub(): void {
    if (this.ctx.pendingCommand === undefined) {
      throw new Error("no pending command waiter");
    }
    const answer = waitForCommandChannelAnswer(this.ctx.commandCtx!);
    this.ctx.commandChannel!.notify.dispatchSub();
    this.bridgeCommandAnswer(answer);
  }

  dispatchShow(objectName: string): void {
    if (this.ctx.pendingCommand === undefined) {
      throw new Error("no pending command waiter");
    }
    const answer = waitForCommandChannelAnswer(this.ctx.commandCtx!);
    this.ctx.commandChannel!.notify.dispatchShow(objectName);
    this.bridgeCommandAnswer(answer);
  }

  dispatchNextMessage(messageType?: string): void {
    if (this.ctx.pendingCommand === undefined) {
      throw new Error("no pending command waiter");
    }
    const answer = waitForCommandChannelAnswer(this.ctx.commandCtx!);
    this.ctx.commandChannel!.notify.dispatchNextMessage(messageType);
    this.bridgeCommandAnswer(answer);
  }

  dispatchStopServer(password = ""): void {
    if (this.ctx.pendingCommand === undefined) {
      throw new Error("no pending command waiter");
    }
    this.ctx.closed = true;
    const answer = waitForCommandChannelAnswer(this.ctx.commandCtx!);
    this.ctx.commandChannel!.notify.dispatchStopServer(password);
    this.bridgeCommandAnswer(answer);
  }

  dispatchReportClients(): void {
    if (this.ctx.pendingCommand === undefined) {
      throw new Error("no pending command waiter");
    }
    const answer = waitForCommandChannelAnswer(this.ctx.commandCtx!);
    this.ctx.commandChannel!.notify.dispatchReportClients();
    this.bridgeCommandAnswer(answer);
  }

  dispatchNotificationRequest(about: string, tool?: string): void {
    if (this.ctx.pendingCommand === undefined) {
      throw new Error("no pending command waiter");
    }
    const target = tool ?? this.ctx.notificationCtx!.getRawClientId();
    const answer = waitForCommandChannelAnswer(this.ctx.commandCtx!);
    this.ctx.commandChannel!.notify.dispatchNotificationRequest(about, target);
    this.bridgeCommandAnswer(answer);
  }

  dispatchGetNotificationMessage(_timeoutMs?: number): void {
    if (this.ctx.pendingNotification === undefined) {
      throw new Error("no pending notification waiter");
    }
    const channelAnswer = waitForNotificationChannelAnswer(this.ctx.notificationCtx!);
    this.ctx.notificationChannel!.notify.beginGetNotification(_timeoutMs);
    const waiter = this.ctx.pendingNotification;
    void channelAnswer.then(
      (answer) => {
        waiter.resolve(answer);
        this.ctx.pendingNotification = undefined;
      },
      (err: Error) => {
        waiter.reject(err);
        this.ctx.pendingNotification = undefined;
      },
    );
  }
}

export class ConnectionClosing extends ConnectionBase {
  protected override _checkInvariant(): void {
    inv.assertConnectionClosing(this.ctx);
  }

  onEntry(): void {
    if (!this.ctx.commandChannelClosed) {
      this.ctx.commandChannel?.notify.close();
      return;
    }
    if (!this.ctx.notificationChannelClosed) {
      this.ctx.notificationChannel?.notify.close();
    }
  }

  close(): void {
    this._checkInvariant();
  }
}

export class ConnectionTerminal extends ConnectionBase {
  protected override _checkInvariant(): void {
    inv.assertConnectionTerminal(this.ctx);
  }

  close(): void {
    this._checkInvariant();
  }

  rejectCommand(): void {
    throw new Error(this.ctx.brokenReason ?? "connection is closed");
  }
}

export class ConnectionClosed extends ConnectionTerminal {
  protected override _checkInvariant(): void {
    inv.assertConnectionClosed(this.ctx);
  }

  onEntry(): void {
    this.ctx.resolvePendingClose();
  }
}

export class ConnectionBroken extends ConnectionTerminal {
  protected override _checkInvariant(): void {
    inv.assertConnectionBroken(this.ctx);
  }

  onEntry(): void {
    this.ctx.rejectPendingClose(new Error(this.ctx.brokenReason ?? "connection broken"));
  }
}

ihsm.registerStateNames({ CBConnectionTop });
ihsm.registerStateNames(self);
