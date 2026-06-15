import type { CBAnswer } from "../../shared/CBServerDefs";
import type { CBCommandKind, CBCommandParams } from "./CBCommandKind";
import { CBCommandSlot, makeCommandRequest } from "./CBCommandRequest";
import type { CBCommandRequest } from "./CBCommandRequest";

export type CommandAux =
  | { type: "whyDrain"; parts: string[] }
  | { type: "tellTxn"; chunks: string[]; index: number; merged?: CBAnswer };

export type QueuedCommand = {
  readonly id: string;
  readonly kind: CBCommandKind;
  readonly params: CBCommandParams;
  readonly slot: CBCommandSlot;
  aux?: CommandAux;
};

/**
 * Connection command table + FIFO queue.
 * At most one command is active on the wire at a time.
 */
export class CBCommandQueue {
  readonly table = new Map<string, QueuedCommand>();
  readonly queue: string[] = [];
  activeId?: string;
  private seq = 0;

  enqueue(params: CBCommandParams): CBCommandRequest {
    const id = String(++this.seq);
    const slot = new CBCommandSlot(id, params.kind);
    const entry: QueuedCommand = { id, kind: params.kind, params, slot };
    this.table.set(id, entry);
    this.queue.push(id);
    return makeCommandRequest(slot, this);
  }

  peek(): QueuedCommand | undefined {
    const id = this.queue[0];
    if (id === undefined) {
      return undefined;
    }
    return this.table.get(id);
  }

  markActive(id: string): void {
    this.activeId = id;
  }

  completeActive(event: { type: "answer"; answer: CBAnswer } | { type: "error"; error: Error }): void {
    const id = this.activeId;
    if (id === undefined) {
      return;
    }
    const entry = this.table.get(id);
    if (entry === undefined) {
      this.activeId = undefined;
      return;
    }
    if (event.type === "answer") {
      entry.slot.terminateAnswer(event.answer);
    } else {
      entry.slot.terminateError(event.error);
    }
    this.table.delete(id);
    if (this.queue[0] === id) {
      this.queue.shift();
    }
    this.activeId = undefined;
  }

  emitActiveNotification(answer: CBAnswer): void {
    const id = this.activeId;
    if (id === undefined) {
      return;
    }
    this.table.get(id)?.slot.emitNotification(answer);
  }

  cancelQueued(id: string, error: Error): void {
    const entry = this.table.get(id);
    if (entry === undefined || entry.slot.isTerminated) {
      return;
    }
    const index = this.queue.indexOf(id);
    if (index < 0) {
      return;
    }
    if (this.activeId === id) {
      return;
    }
    this.queue.splice(index, 1);
    entry.slot.terminateError(error);
    this.table.delete(id);
  }

  rejectAll(message: string): void {
    const error = new Error(message);
    const ids = [...this.queue];
    for (const id of ids) {
      const entry = this.table.get(id);
      if (entry === undefined) {
        continue;
      }
      if (entry.slot.isTerminated) {
        continue;
      }
      entry.slot.terminateError(error);
      this.table.delete(id);
    }
    this.queue.length = 0;
    this.activeId = undefined;
  }
}
