import { IpcAnswer } from "../../shared/CBServerDefs";
import type { CBAnswer } from "../../shared/CBServerDefs";
import type { CBCommandChannelActorRef } from "../commandChannel/CBCommandChannelConfig";
import type { CBNotificationChannelActorRef } from "../notificationChannel/CBNotificationChannelConfig";
import { isIpcNotification } from "../../shared/cbIpcCatalog";
import { tryParseTcpLengthFrame } from "./tcpFraming";

export interface ICBConnectionReaderContext {
  readonly connection?: CBCommandChannelActorRef | CBNotificationChannelActorRef;
  buffer: string;
  interrupted: boolean;
  interruptedPosted: boolean;
  appendChunk(chunk: string): void;
  tryTakeAnswer(): CBAnswer | undefined;
  resetBuffer(): void;
  postAnswer(answer: CBAnswer): void;
  postNotification(answer: CBAnswer): void;
  postFailed(message: string): void;
  drainSpontaneousNotifications(): void;
  postInterrupted(): void;
  interrupt(): void;
}

export class CBConnectionReaderContext implements ICBConnectionReaderContext {
  readonly connection?: CBCommandChannelActorRef | CBNotificationChannelActorRef;
  buffer = "";
  interrupted = false;
  interruptedPosted = false;

  constructor(connection?: CBCommandChannelActorRef | CBNotificationChannelActorRef) {
    this.connection = connection;
  }

  appendChunk(chunk: string): void {
    if (chunk.length > 0) {
      this.buffer += chunk;
    }
  }

  tryTakeAnswer(): CBAnswer | undefined {
    const parsed: { consumed: number; body: string } | undefined = tryParseTcpLengthFrame(this.buffer);
    if (parsed === undefined) {
      return undefined;
    }
    this.buffer = this.buffer.slice(parsed.consumed);
    return IpcAnswer.fromTerm(parsed.body);
  }

  resetBuffer(): void {
    this.buffer = "";
  }

  postAnswer(answer: CBAnswer): void {
    if (this.interrupted) {
      return;
    }
    this.connection?.notify.onReaderAnswer(answer);
  }

  postNotification(answer: CBAnswer): void {
    if (this.interrupted) {
      return;
    }
    this.connection?.notify.onReaderNotification(answer);
  }

  drainSpontaneousNotifications(): void {
    for (;;) {
      const parsed: { consumed: number; body: string } | undefined = tryParseTcpLengthFrame(this.buffer);
      if (parsed === undefined) {
        return;
      }
      const answer: CBAnswer = IpcAnswer.fromTerm(parsed.body);
      if (!isIpcNotification(answer.completion)) {
        return;
      }
      this.buffer = this.buffer.slice(parsed.consumed);
      this.postNotification(answer);
    }
  }

  postFailed(message: string): void {
    if (this.interrupted) {
      return;
    }
    this.connection?.notify.onReaderFailed(message);
  }

  postInterrupted(): void {
    if (this.interruptedPosted) {
      return;
    }
    this.interruptedPosted = true;
    this.connection?.notify.onReaderInterrupted();
  }

  interrupt(): void {
    this.interrupted = true;
    this.resetBuffer();
  }
}
