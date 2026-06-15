import { buildEnrollPayload, buildIpcMessage, decodeCbString, lengthPrefix, } from "@mmkit/base";
import type { CBAnswer } from "../../shared/CBServerDefs";
import type { CBTcpConnectionOptions } from "../../shared/CBTcpOptions";
import { enrollUserSuffix } from "../../shared/enrollUserSuffix";
import type { CBConnectionReaderActor } from "../reader/CBConnectionReaderConfig";
import type { CBConnectionWriterActor } from "../writer/CBConnectionWriterConfig";
import { CB_IPC_METHODS } from "../../shared/cbIpcCatalog";
import type { CBNotificationChannelActorRef } from "./CBNotificationChannelConfig";

export type NotificationEnrollRequest = {
  method: string;
  data: string;
  client?: string;
  server?: string;
  resolve(answer: CBAnswer): void;
  reject(error: Error): void;
};

export type CBNotificationChannelTcpChildren = {
  reader: CBConnectionReaderActor;
  writer: CBConnectionWriterActor;
};

/** Mutable domain state for the notification TCP channel actor. */
export interface ICBNotificationChannelContext {
  readonly connectionId: string;
  readonly onChannelClosed: () => void;
  readonly onChannelBroken: (message: string) => void;
  readonly tcp: CBTcpConnectionOptions;
  closed: boolean;
  channelMailbox?: CBNotificationChannelActorRef;
  children?: CBNotificationChannelTcpChildren;
  clientId: string;
  serverId: string;
  enrolled: boolean;
  requestQueue: NotificationEnrollRequest[];
  notificationQueue: CBAnswer[];
  activeRequest?: NotificationEnrollRequest;
  pendingFrame?: Buffer;
  awaitReaderInterrupted: boolean;
  awaitWriterInterrupted: boolean;
  brokenReason?: string;
  bootstrapDone?: { resolve(): void; reject(error: Error): void };
  pendingNotification?: { resolve(answer: CBAnswer): void; reject(error: Error): void };
  pendingClose?: { resolve(): void; reject(error: Error): void };
  notificationReadTimer?: number;
  allocEnrollCommand(): NotificationEnrollRequest;
  consumePendingNotification(): { resolve(answer: CBAnswer): void; reject(error: Error): void };
  resolvePendingClose(): void;
  rejectPendingClose(error: Error): void;
  buildIpcFrame(method: string, data: string, client?: string, server?: string): Buffer;
  rejectAllPending(message: string): void;
  beginDetachChildren(): void;
  dispatchInterruptToChildren(): void;
  noteReaderInterrupted(): void;
  noteWriterInterrupted(): void;
  allInterrupted(): boolean;
  getRawClientId(): string;
}

export class CBNotificationChannelContext implements ICBNotificationChannelContext {
  readonly connectionId: string;
  readonly onChannelClosed: () => void;
  readonly onChannelBroken: (message: string) => void;
  readonly tcp: CBTcpConnectionOptions;
  readonly requestQueue: NotificationEnrollRequest[] = [];
  readonly notificationQueue: CBAnswer[] = [];
  closed = false;
  channelMailbox?: CBNotificationChannelActorRef;
  children?: CBNotificationChannelTcpChildren;
  clientId = '""';
  serverId = '"cbserver"';
  enrolled = false;
  activeRequest?: NotificationEnrollRequest;
  pendingFrame?: Buffer;
  awaitReaderInterrupted = false;
  awaitWriterInterrupted = false;
  brokenReason?: string;
  bootstrapDone?: { resolve(): void; reject(error: Error): void };
  pendingNotification?: { resolve(answer: CBAnswer): void; reject(error: Error): void };
  pendingClose?: { resolve(): void; reject(error: Error): void };
  notificationReadTimer?: number;

  constructor( connectionId: string, onChannelClosed: () => void, onChannelBroken: (message: string) => void, tcp: CBTcpConnectionOptions ) {
    this.connectionId = connectionId;
    this.onChannelClosed = onChannelClosed;
    this.onChannelBroken = onChannelBroken;
    this.tcp = tcp;
  }

  getRawClientId(): string {
    return decodeCbString(this.clientId) ?? this.clientId.replace(/^"|"$/g, "");
  }

  consumePendingNotification(): { resolve(answer: CBAnswer): void; reject(error: Error): void } {
    const waiter: { resolve(answer: CBAnswer): void; reject(error: Error): void } | undefined = this.pendingNotification;
    if (waiter === undefined) {
      throw new Error("no pending notification waiter");
    }
    this.pendingNotification = undefined;
    return waiter;
  }

  resolvePendingClose(): void {
    this.pendingClose?.resolve();
    this.pendingClose = undefined;
  }

  rejectPendingClose(error: Error): void {
    this.pendingClose?.reject(error);
    this.pendingClose = undefined;
  }

  allocEnrollCommand(): NotificationEnrollRequest {
    return {
      method: CB_IPC_METHODS.ENROLL_ME,
      data: buildEnrollPayload(this.tcp.toolName ?? "mmkit", enrollUserSuffix(this.tcp.userName)),
      client: '""',
      server: '""',
      resolve: () => undefined,
      reject: () => undefined,
    };
  }

  buildIpcFrame(method: string, data: string, client = this.clientId, server = this.serverId): Buffer {
    const message: string = buildIpcMessage(client, server, method, data);
    return lengthPrefix(message);
  }

  rejectAllPending(message: string): void {
    const error: Error = new Error(message);
    if (this.pendingNotification !== undefined) {
      const waiter: { resolve(answer: CBAnswer): void; reject(error: Error): void } = this.pendingNotification;
      this.pendingNotification = undefined;
      waiter.reject(error);
    }
    this.rejectPendingClose(error);
  }

  beginDetachChildren(): void {
    if (this.children === undefined) {
      this.awaitReaderInterrupted = false;
      this.awaitWriterInterrupted = false;
      return;
    }
    this.awaitReaderInterrupted = true;
    this.awaitWriterInterrupted = true;
  }

  dispatchInterruptToChildren(): void {
    const children: CBNotificationChannelTcpChildren | undefined = this.children;
    if (children === undefined) {
      return;
    }
    if (this.awaitReaderInterrupted) {
      children.reader.notify.interrupt();
    }
    if (this.awaitWriterInterrupted) {
      children.writer.notify.interrupt();
    }
    this.children = undefined;
  }

  noteReaderInterrupted(): void {
    this.awaitReaderInterrupted = false;
  }

  noteWriterInterrupted(): void {
    this.awaitWriterInterrupted = false;
  }

  allInterrupted(): boolean {
    return !this.awaitReaderInterrupted && !this.awaitWriterInterrupted;
  }
}

/** Await ENROLL_ME completion — must not be called from inside an actor service (ihsm RTC). */
export function waitForNotificationChannelBootstrap(ctx: ICBNotificationChannelContext): Promise<void> {
  return new Promise<void>( (resolve, reject) => { ctx.bootstrapDone = { resolve, reject }; } );
}

/** Await a notification read on the notification channel. */
export function waitForNotificationChannelAnswer(ctx: ICBNotificationChannelContext): Promise<CBAnswer> {
  return new Promise<CBAnswer>( (resolve, reject) => { ctx.pendingNotification = { resolve, reject }; } );
}

/** Await graceful notification channel close. */
export function waitForNotificationChannelClose(ctx: ICBNotificationChannelContext): Promise<void> {
  return new Promise<void>( (resolve, reject) => { ctx.pendingClose = { resolve, reject }; } );
}
