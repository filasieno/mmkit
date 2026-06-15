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

import type { CBConnectionActorHandle } from "../actors/connection/CBServerConnectionConfig";
import type { CBCommandRequest } from "../actors/connection/CBCommandRequest";
import { waitCommand } from "../actors/connection/CBCommandRequest";
import type { CBServerInitializeRequest } from "../actors/server/CBServerInitializeRequest";
import { waitInitialize } from "../actors/server/CBServerInitializeRequest";

export type { CBConnectionActorHandle, CBCommandRequest, CBServerInitializeRequest };
export { waitCommand, waitInitialize };

export interface ICBConnectionOptions {
  label?: string;
  userName?: string;
  timeoutMs?: number;
  connectTimeoutMs?: number;
  socketTimeoutMs?: number;
  autoConnect?: boolean;
  startupProbeCommand?: "pwd" | "who";
}
