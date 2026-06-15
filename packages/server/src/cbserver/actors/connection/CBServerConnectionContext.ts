import type { CBTcpConnectionOptions } from "../../shared/CBTcpOptions";
import type { CBCommandChannelPortInput, CBCommandChannelActor } from "../commandChannel/CBCommandChannelConfig";
import type { CBNotificationChannelPortInput, CBNotificationChannelActor } from "../notificationChannel/CBNotificationChannelConfig";
import type { CBConnectionActorRef } from "./CBServerConnectionConfig";
import type { ICBCommandChannelContext } from "../commandChannel/CBCommandChannelContext";
import type { ICBNotificationChannelContext } from "../notificationChannel/CBNotificationChannelContext";
import type { CBAnswer } from "../../shared/CBServerDefs";

/**
 * Mutable domain state for the connection orchestrator (dual TCP channels).
 */
export interface ICBConnectionContext {
  readonly connectionId: string;
  readonly onClose: () => void;
  readonly tcp: CBTcpConnectionOptions;
  closed: boolean;
  brokenReason?: string;
  commandChannel?: CBCommandChannelActor;
  notificationChannel?: CBNotificationChannelActor;
  commandCtx?: ICBCommandChannelContext;
  notificationCtx?: ICBNotificationChannelContext;
  orchestratorMailbox?: CBConnectionActorRef;
  channelPorts?: {
    command?: CBCommandChannelPortInput;
    notification?: CBNotificationChannelPortInput;
  };
  bootstrapDone?: { resolve(): void; reject(error: Error): void };
  pendingCommand?: { resolve(answer: CBAnswer): void; reject(error: Error): void };
  pendingNotification?: { resolve(answer: CBAnswer): void; reject(error: Error): void };
  pendingClose?: { resolve(): void; reject(error: Error): void };
  commandChannelClosed: boolean;
  notificationChannelClosed: boolean;
  resolvePendingClose(): void;
  rejectPendingClose(error: Error): void;
  rejectAllPending(message: string): void;
  noteCommandChannelClosed(): void;
  noteNotificationChannelClosed(): void;
  bothChannelsClosed(): boolean;
}

export class CBConnectionContext implements ICBConnectionContext {
  readonly connectionId: string;
  readonly onClose: () => void;
  readonly tcp: CBTcpConnectionOptions;
  closed = false;
  brokenReason?: string;
  commandChannel?: CBCommandChannelActor;
  notificationChannel?: CBNotificationChannelActor;
  commandCtx?: ICBCommandChannelContext;
  notificationCtx?: ICBNotificationChannelContext;
  orchestratorMailbox?: CBConnectionActorRef;
  channelPorts?: {
    command?: CBCommandChannelPortInput;
    notification?: CBNotificationChannelPortInput;
  };
  bootstrapDone?: { resolve(): void; reject(error: Error): void };
  pendingCommand?: { resolve(answer: CBAnswer): void; reject(error: Error): void };
  pendingNotification?: { resolve(answer: CBAnswer): void; reject(error: Error): void };
  pendingClose?: { resolve(): void; reject(error: Error): void };
  commandChannelClosed = false;
  notificationChannelClosed = false;

  constructor( connectionId: string, onClose: () => void, tcp: CBTcpConnectionOptions, channelPorts?: ICBConnectionContext["channelPorts"] ) {
    this.connectionId = connectionId;
    this.onClose = onClose;
    this.tcp = tcp;
    this.channelPorts = channelPorts;
  }

  resolvePendingClose(): void {
    this.pendingClose?.resolve();
    this.pendingClose = undefined;
  }

  rejectPendingClose(error: Error): void {
    this.pendingClose?.reject(error);
    this.pendingClose = undefined;
  }

  rejectAllPending(message: string): void {
    const error: Error = new Error(message);
    if (this.pendingCommand !== undefined) {
      const waiter: NonNullable<ICBConnectionContext["pendingCommand"]> = this.pendingCommand;
      this.pendingCommand = undefined;
      waiter.reject(error);
    }
    if (this.pendingNotification !== undefined) {
      const waiter: NonNullable<ICBConnectionContext["pendingNotification"]> = this.pendingNotification;
      this.pendingNotification = undefined;
      waiter.reject(error);
    }
    this.rejectPendingClose(error);
  }

  noteCommandChannelClosed(): void {
    this.commandChannelClosed = true;
  }

  noteNotificationChannelClosed(): void {
    this.notificationChannelClosed = true;
  }

  bothChannelsClosed(): boolean {
    return this.commandChannelClosed && this.notificationChannelClosed;
  }
}

/** Await both channel ENROLL completions. */
export function waitForConnectionBootstrap(ctx: ICBConnectionContext): Promise<void> {
  return new Promise<void>( (resolve, reject) => { ctx.bootstrapDone = { resolve, reject }; } );
}

/** Await the next orchestrator command answer. */
export function waitForCommandAnswer(ctx: ICBConnectionContext): Promise<CBAnswer> {
  return new Promise<CBAnswer>( (resolve, reject) => { ctx.pendingCommand = { resolve, reject }; } );
}

/** Await a notification from the notification channel. */
export function waitForNotificationAnswer(ctx: ICBConnectionContext): Promise<CBAnswer> {
  return new Promise<CBAnswer>( (resolve, reject) => { ctx.pendingNotification = { resolve, reject }; } );
}

/** Await graceful dual-channel close. */
export function waitForConnectionClose(ctx: ICBConnectionContext): Promise<void> {
  return new Promise<void>( (resolve, reject) => { ctx.pendingClose = { resolve, reject }; } );
}
