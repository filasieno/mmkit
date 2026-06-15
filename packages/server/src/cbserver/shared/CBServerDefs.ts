import { parseAnswerTerm, toCbAnswer } from "@mmkit/base";
import type { CbAnswer } from "@mmkit/base";

/** Parsed ipcanswer from a TCP session or Prolog term. */
export class IpcAnswer {
  readonly ok: boolean;
  readonly completion: string;
  readonly result?: string;
  readonly term: string;

  constructor(term: string, ok: boolean, completion: string, result?: string) {
    this.term = term;
    this.ok = ok;
    this.completion = completion;
    this.result = result;
  }

  static fromTerm(term: string): IpcAnswer {
    const parsed: CbAnswer = toCbAnswer(parseAnswerTerm(term));
    return new IpcAnswer(term, parsed.ok, parsed.completion, parsed.result);
  }
}

export type CBAnswer = IpcAnswer;

export type StatusListener = (state: string) => void;

/** Stdio stream observed from the cbserver subprocess. */
export type ProcessStream = "stdout" | "stderr";

export type ProcessIoListener = (stream: ProcessStream, line: string) => void;

/** POSIX signal name accepted by `ChildProcess.kill`. */
export type ProcessSignal = NodeJS.Signals;

export interface ICBConnection {
  getConnectionId(): Promise<string>;
  close(): Promise<void>;
  tell(frames: string): Promise<CBAnswer>;
  untell(frames: string): Promise<CBAnswer>;
  retell(untellFrames: string, tellFrames: string): Promise<CBAnswer>;
  tellModel(...files: string[]): Promise<CBAnswer>;
  ask(query: string, queryFormat?: string, answerRep?: string, rollbackTime?: string): Promise<CBAnswer>;
  hypoAsk(frames: string, query: string, queryFormat?: string, answerRep?: string, rollbackTime?: string): Promise<CBAnswer>;
  lpicall(lpiCall: string): Promise<CBAnswer>;
  prolog(statement: string): Promise<CBAnswer>;
  why(): Promise<CBAnswer>;
  cd(modulePath?: string): Promise<CBAnswer>;
  pwd(): Promise<CBAnswer>;
  lm(modulePath?: string): Promise<CBAnswer>;
  ls(className?: string): Promise<CBAnswer>;
  mkdir(moduleName: string): Promise<CBAnswer>;
  who(): Promise<CBAnswer>;
  sub(): Promise<CBAnswer>;
  show(objectName: string): Promise<CBAnswer>;
  nextMessage(messageType?: string): Promise<CBAnswer>;
  stopServer(password?: string): Promise<CBAnswer>;
  reportClients(): Promise<CBAnswer>;
  notificationRequest(about: string, tool?: string): Promise<CBAnswer>;
  getNotificationMessage(timeoutMs?: number): Promise<CBAnswer>;
  getClientId(): Promise<string>;
  getNotificationClientId(): Promise<string>;
}

export interface ICBConnectionOptions {
  label?: string;
  userName?: string;
  timeoutMs?: number;
  connectTimeoutMs?: number;
  socketTimeoutMs?: number;
  autoConnect?: boolean;
  startupProbeCommand?: "pwd" | "who";
}
