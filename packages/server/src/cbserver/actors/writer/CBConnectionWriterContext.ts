import type { CBCommandChannelActorRef } from "../commandChannel/CBCommandChannelConfig";
import type { CBNotificationChannelActorRef } from "../notificationChannel/CBNotificationChannelConfig";

export interface ICBConnectionWriterContext {
  readonly connection?: CBCommandChannelActorRef | CBNotificationChannelActorRef;
  interrupted: boolean;
  interruptedPosted: boolean;
  postWriteComplete(): void;
  postWriteFailed(message: string): void;
  postInterrupted(): void;
  interrupt(): void;
}

export class CBConnectionWriterContext implements ICBConnectionWriterContext {
  readonly connection?: CBCommandChannelActorRef | CBNotificationChannelActorRef;
  interrupted = false;
  interruptedPosted = false;

  constructor(connection?: CBCommandChannelActorRef | CBNotificationChannelActorRef) {
    this.connection = connection;
  }

  postWriteComplete(): void {
    if (this.interrupted) {
      return;
    }
    this.connection?.notify.onWriterComplete();
  }

  postWriteFailed(message: string): void {
    if (this.interrupted) {
      return;
    }
    this.connection?.notify.onWriterFailed(message);
  }

  postInterrupted(): void {
    if (this.interruptedPosted) {
      return;
    }
    this.interruptedPosted = true;
    this.connection?.notify.onWriterInterrupted();
  }

  interrupt(): void {
    this.interrupted = true;
  }
}
