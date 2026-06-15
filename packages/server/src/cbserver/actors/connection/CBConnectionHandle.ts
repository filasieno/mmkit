import type { CBAnswer, ICBConnection } from "../../shared/CBServerDefs";
import { IpcAnswer } from "../../shared/CBServerDefs";
import { collectErrorReports, normalizeAskNilResult, tellTransactions } from "./cbJavaCompat";
import type { CBConnectionActorHandle } from "./CBServerConnectionConfig";
import type { ICBConnectionContext } from "./CBServerConnectionContext";
import { waitForCommandAnswer, waitForConnectionClose, waitForNotificationAnswer } from "./CBServerConnectionContext";

export class CBConnectionHandle implements ICBConnection {
  private readonly actor: CBConnectionActorHandle;
  private readonly ctx: ICBConnectionContext;

  constructor(actor: CBConnectionActorHandle, ctx: ICBConnectionContext) {
    this.actor = actor;
    this.ctx = ctx;
  }

  async getConnectionId(): Promise<string> {
    return this.actor.call.getConnectionId();
  }

  async getClientId(): Promise<string> {
    return this.actor.call.getClientId();
  }

  async getNotificationClientId(): Promise<string> {
    return this.actor.call.getNotificationClientId();
  }

  async close(): Promise<void> {
    const done = waitForConnectionClose(this.ctx);
    this.actor.notify.close();
    await done;
  }

  async tell(frames: string): Promise<CBAnswer> {
    return tellTransactions((chunk) => this.tellOne(chunk), frames);
  }

  private async tellOne(frames: string): Promise<CBAnswer> {
    const answer = waitForCommandAnswer(this.ctx);
    this.actor.notify.dispatchTell(frames);
    return answer;
  }

  async untell(frames: string): Promise<CBAnswer> {
    const answer = waitForCommandAnswer(this.ctx);
    this.actor.notify.dispatchUntell(frames);
    return answer;
  }

  async retell(untellFrames: string, tellFrames: string): Promise<CBAnswer> {
    const answer = waitForCommandAnswer(this.ctx);
    this.actor.notify.dispatchRetell(untellFrames, tellFrames);
    return answer;
  }

  async tellModel(...files: string[]): Promise<CBAnswer> {
    const answer = waitForCommandAnswer(this.ctx);
    this.actor.notify.dispatchTellModel(...files);
    return answer;
  }

  async ask(query: string, queryFormat?: string, answerRep?: string, rollbackTime?: string): Promise<CBAnswer> {
    const answer = waitForCommandAnswer(this.ctx);
    this.actor.notify.dispatchAsk(query, queryFormat, answerRep, rollbackTime);
    return normalizeAskNilResult(await answer, answerRep);
  }

  async hypoAsk(frames: string, query: string, queryFormat?: string, answerRep?: string, rollbackTime?: string): Promise<CBAnswer> {
    const answer = waitForCommandAnswer(this.ctx);
    this.actor.notify.dispatchHypoAsk(frames, query, queryFormat, answerRep, rollbackTime);
    return normalizeAskNilResult(await answer, answerRep);
  }

  async lpicall(lpiCall: string): Promise<CBAnswer> {
    const answer = waitForCommandAnswer(this.ctx);
    this.actor.notify.dispatchLpicall(lpiCall);
    return answer;
  }

  async prolog(statement: string): Promise<CBAnswer> {
    const answer = waitForCommandAnswer(this.ctx);
    this.actor.notify.dispatchProlog(statement);
    return answer;
  }

  async why(): Promise<CBAnswer> {
    return collectErrorReports((type) => this.nextMessage(type));
  }

  async cd(modulePath?: string): Promise<CBAnswer> {
    const answer = waitForCommandAnswer(this.ctx);
    this.actor.notify.dispatchCd(modulePath);
    return answer;
  }

  async pwd(): Promise<CBAnswer> {
    const answer = waitForCommandAnswer(this.ctx);
    this.actor.notify.dispatchPwd();
    return answer;
  }

  async lm(modulePath?: string): Promise<CBAnswer> {
    const answer = waitForCommandAnswer(this.ctx);
    this.actor.notify.dispatchLm(modulePath);
    return normalizeAskNilResult(await answer, "FRAME");
  }

  async ls(className?: string): Promise<CBAnswer> {
    const answer = waitForCommandAnswer(this.ctx);
    this.actor.notify.dispatchLs(className);
    return normalizeAskNilResult(await answer, "LABEL");
  }

  async mkdir(moduleName: string): Promise<CBAnswer> {
    const answer = waitForCommandAnswer(this.ctx);
    this.actor.notify.dispatchMkdir(moduleName);
    return answer;
  }

  async who(): Promise<CBAnswer> {
    const answer = waitForCommandAnswer(this.ctx);
    this.actor.notify.dispatchWho();
    return normalizeAskNilResult(await answer, "LABEL");
  }

  async sub(): Promise<CBAnswer> {
    const answer = waitForCommandAnswer(this.ctx);
    this.actor.notify.dispatchSub();
    return normalizeAskNilResult(await answer, "LABEL");
  }

  async show(objectName: string): Promise<CBAnswer> {
    const answer = waitForCommandAnswer(this.ctx);
    this.actor.notify.dispatchShow(objectName);
    return normalizeAskNilResult(await answer, "FRAME");
  }

  async nextMessage(messageType?: string): Promise<CBAnswer> {
    const answer = waitForCommandAnswer(this.ctx);
    this.actor.notify.dispatchNextMessage(messageType);
    return answer;
  }

  async stopServer(password = ""): Promise<CBAnswer> {
    const answer = waitForCommandAnswer(this.ctx);
    this.actor.notify.dispatchStopServer(password);
    return answer;
  }

  async reportClients(): Promise<CBAnswer> {
    const answer = waitForCommandAnswer(this.ctx);
    this.actor.notify.dispatchReportClients();
    return answer;
  }

  async notificationRequest(about: string, tool?: string): Promise<CBAnswer> {
    const answer = waitForCommandAnswer(this.ctx);
    this.actor.notify.dispatchNotificationRequest(about, tool);
    return answer;
  }

  async getNotificationMessage(timeoutMs = 0): Promise<CBAnswer> {
    const answer = waitForNotificationAnswer(this.ctx);
    this.actor.notify.dispatchGetNotificationMessage(timeoutMs);
    return answer;
  }
}
