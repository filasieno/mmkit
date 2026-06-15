import type { CBTcpConnectionOptions } from "../../shared/CBTcpOptions";
import type { CBCommandChannelPortInput, CBCommandChannelActor } from "../commandChannel/CBCommandChannelConfig";
import type { CBNotificationChannelPortInput, CBNotificationChannelActor } from "../notificationChannel/CBNotificationChannelConfig";
import type { CBConnectionActorRef } from "./CBServerConnectionConfig";
import type { ICBCommandChannelContext } from "../commandChannel/CBCommandChannelContext";
import type { ICBNotificationChannelContext } from "../notificationChannel/CBNotificationChannelContext";
import { CBCommandQueue } from "./CBCommandQueue";
import type { CBCommandParams } from "./CBCommandKind";
import type { CBCommandRequest } from "./CBCommandRequest";

/**
 * Mutable domain state for the connection orchestrator (dual TCP channels).
 */
export interface ICBConnectionContext {
  readonly connectionId: string;
  readonly onClose: () => void;
  readonly tcp: CBTcpConnectionOptions;
  readonly commands: CBCommandQueue;
  closed: boolean;
  /** Close requested but deferred until the command queue drains (e.g. after `stopServer`). */
  closeRequested: boolean;
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
  pendingClose?: { resolve(): void; reject(error: Error): void };
  commandChannelClosed: boolean;
  notificationChannelClosed: boolean;
  resolvePendingClose(): void;
  rejectPendingClose(error: Error): void;
  rejectAllPending(message: string): void;
  noteCommandChannelClosed(): void;
  noteNotificationChannelClosed(): void;
  bothChannelsClosed(): boolean;
  enqueueCommand(params: CBCommandParams): CBCommandRequest;
}

export class CBConnectionContext implements ICBConnectionContext {
  readonly connectionId: string;
  readonly onClose: () => void;
  readonly tcp: CBTcpConnectionOptions;
  readonly commands = new CBCommandQueue();
  closed = false;
  closeRequested = false;
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
  pendingClose?: { resolve(): void; reject(error: Error): void };
  commandChannelClosed = false;
  notificationChannelClosed = false;

  constructor( connectionId: string, onClose: () => void, tcp: CBTcpConnectionOptions, channelPorts?: ICBConnectionContext["channelPorts"] ) {
    this.connectionId = connectionId;
    this.onClose = onClose;
    this.tcp = tcp;
    this.channelPorts = channelPorts;
  }

  enqueueCommand(params: CBCommandParams): CBCommandRequest {
    return this.commands.enqueue(params);
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
    this.commands.rejectAll(message);
    this.rejectPendingClose(new Error(message));
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

/** Await graceful dual-channel close. */
export function waitForConnectionClose(ctx: ICBConnectionContext): Promise<void> {
  return new Promise<void>( (resolve, reject) => { ctx.pendingClose = { resolve, reject }; } );
}
