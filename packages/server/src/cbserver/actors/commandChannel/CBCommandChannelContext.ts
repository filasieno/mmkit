import * as os from "node:os";
import {
  buildEnrollPayload,
  buildIpcMessage,
  decodeCbString,
  lengthPrefix,
} from "@mmkit/shared/dist/cb-tcp";
import type { CBAnswer } from "../../shared/CBServerDefs";
import type { CBTcpConnectionOptions } from "../../shared/CBTcpOptions";
import type { CBConnectionReaderActor } from "../reader/CBConnectionReaderConfig";
import type { CBConnectionWriterActor } from "../writer/CBConnectionWriterConfig";
import { CB_IPC_METHODS } from "../../shared/cbIpcCatalog";
import type { CBCommandChannelActorRef } from "./CBCommandChannelConfig";

export type CommandPendingRequest = {
  method: string;
  data: string;
  client?: string;
  server?: string;
  resolve(answer: CBAnswer): void;
  reject(error: Error): void;
};

export type CBCommandChannelTcpChildren = {
  reader: CBConnectionReaderActor;
  writer: CBConnectionWriterActor;
};

/** Mutable domain state for the command TCP channel actor. */
export interface ICBCommandChannelContext {
  readonly connectionId: string;
  readonly onChannelClosed: () => void;
  readonly onChannelBroken: (message: string) => void;
  readonly tcp: CBTcpConnectionOptions;
  closed: boolean;
  channelMailbox?: CBCommandChannelActorRef;
  children?: CBCommandChannelTcpChildren;
  clientId: string;
  serverId: string;
  enrolled: boolean;
  requestQueue: CommandPendingRequest[];
  activeRequest?: CommandPendingRequest;
  pendingFrame?: Buffer;
  awaitReaderInterrupted: boolean;
  awaitWriterInterrupted: boolean;
  brokenReason?: string;
  bootstrapDone?: { resolve(): void; reject(error: Error): void };
  pendingCommand?: { resolve(answer: CBAnswer): void; reject(error: Error): void };
  pendingClose?: { resolve(): void; reject(error: Error): void };
  allocEnrollCommand(): CommandPendingRequest;
  consumePendingCommand(): { resolve(answer: CBAnswer): void; reject(error: Error): void };
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

export class CBCommandChannelContext implements ICBCommandChannelContext {
  readonly connectionId: string;
  readonly onChannelClosed: () => void;
  readonly onChannelBroken: (message: string) => void;
  readonly tcp: CBTcpConnectionOptions;
  readonly requestQueue: CommandPendingRequest[] = [];
  closed = false;
  channelMailbox?: CBCommandChannelActorRef;
  children?: CBCommandChannelTcpChildren;
  clientId = '""';
  serverId = '"cbserver"';
  enrolled = false;
  activeRequest?: CommandPendingRequest;
  pendingFrame?: Buffer;
  awaitReaderInterrupted = false;
  awaitWriterInterrupted = false;
  brokenReason?: string;
  bootstrapDone?: { resolve(): void; reject(error: Error): void };
  pendingCommand?: { resolve(answer: CBAnswer): void; reject(error: Error): void };
  pendingClose?: { resolve(): void; reject(error: Error): void };

  constructor(
    connectionId: string,
    onChannelClosed: () => void,
    onChannelBroken: (message: string) => void,
    tcp: CBTcpConnectionOptions,
  ) {
    this.connectionId = connectionId;
    this.onChannelClosed = onChannelClosed;
    this.onChannelBroken = onChannelBroken;
    this.tcp = tcp;
  }

  getRawClientId(): string {
    return decodeCbString(this.clientId) ?? this.clientId.replace(/^"|"$/g, "");
  }

  consumePendingCommand(): { resolve(answer: CBAnswer): void; reject(error: Error): void } {
    const waiter = this.pendingCommand;
    if (waiter === undefined) {
      throw new Error("no pending command waiter");
    }
    this.pendingCommand = undefined;
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

  allocEnrollCommand(): CommandPendingRequest {
    return {
      method: CB_IPC_METHODS.ENROLL_ME,
      data: buildEnrollPayload(this.tcp.toolName ?? "mmkit", this.enrollUserSuffix()),
      client: '""',
      server: '""',
      resolve: () => undefined,
      reject: () => undefined,
    };
  }

  private enrollUserSuffix(): string {
    const userName = this.tcp.userName ?? "mmkit";
    return `${userName}@${os.hostname()}_${os.arch()}_${os.platform().replace(/\s/g, "")}`;
  }

  buildIpcFrame(method: string, data: string, client = this.clientId, server = this.serverId): Buffer {
    const message = buildIpcMessage(client, server, method, data);
    return lengthPrefix(message);
  }

  rejectAllPending(message: string): void {
    const queued = [...this.requestQueue];
    const active = this.activeRequest;
    this.activeRequest = undefined;
    this.requestQueue.length = 0;
    const error = new Error(message);
    for (const pending of queued) {
      if (pending !== active) {
        pending.reject(error);
      }
    }
    active?.reject(error);
    if (this.pendingCommand !== undefined) {
      const waiter = this.pendingCommand;
      this.pendingCommand = undefined;
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
    const children = this.children;
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
export function waitForCommandChannelBootstrap(ctx: ICBCommandChannelContext): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    ctx.bootstrapDone = { resolve, reject };
  });
}

/** Await the next dispatched command answer on the command channel. */
export function waitForCommandChannelAnswer(ctx: ICBCommandChannelContext): Promise<CBAnswer> {
  return new Promise<CBAnswer>((resolve, reject) => {
    ctx.pendingCommand = { resolve, reject };
  });
}

/** Await graceful command channel close. */
export function waitForCommandChannelClose(ctx: ICBCommandChannelContext): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    ctx.pendingClose = { resolve, reject };
  });
}
