import type * as ihsm from "ihsm";
import type { CBAnswer } from "../../shared/CBServerDefs";
import type { CBCommandKind } from "./CBCommandKind";

/** Non-terminal event while a command is in flight. */
export type CBCommandNotificationEvent = { readonly type: "notification"; readonly answer: CBAnswer };

/** Terminal events — both end the command lifecycle. */
export type CBCommandAnswerEvent = { readonly type: "answer"; readonly answer: CBAnswer };
export type CBCommandErrorEvent = { readonly type: "error"; readonly error: Error };

export type CBCommandTerminalEvent = CBCommandAnswerEvent | CBCommandErrorEvent;
export type CBCommandEvent = CBCommandNotificationEvent | CBCommandTerminalEvent;

export type CBCommandEventType = CBCommandEvent["type"];

/** Mutable command slot — owned by {@link CBCommandQueue}. */
export class CBCommandSlot {
  readonly id: string;
  readonly kind: CBCommandKind;
  private terminated = false;
  private readonly handlers = new Set<(event: CBCommandEvent) => void>();

  constructor(id: string, kind: CBCommandKind) {
    this.id = id;
    this.kind = kind;
  }

  get isTerminated(): boolean {
    return this.terminated;
  }

  on(type: CBCommandEventType, handler: (event: CBCommandEvent) => void): ihsm.Disposable {
    const wrapped = (event: CBCommandEvent): void => {
      if (event.type === type) {
        handler(event);
      }
    };
    this.handlers.add(wrapped);
    return { dispose: () => { this.handlers.delete(wrapped); } };
  }

  private emit(event: CBCommandEvent): void {
    for (const handler of this.handlers) {
      handler(event);
    }
  }

  emitNotification(answer: CBAnswer): void {
    if (this.terminated) {
      return;
    }
    this.emit({ type: "notification", answer });
  }

  terminateAnswer(answer: CBAnswer): void {
    if (this.terminated) {
      return;
    }
    this.terminated = true;
    this.emit({ type: "answer", answer });
    this.handlers.clear();
  }

  terminateError(error: Error): void {
    if (this.terminated) {
      return;
    }
    this.terminated = true;
    this.emit({ type: "error", error });
    this.handlers.clear();
  }
}

export interface CBCommandRequest extends ihsm.Disposable {
  readonly id: string;
  readonly kind: CBCommandKind;
  wait(timeoutMs?: number): Promise<CBAnswer>;
  on(type: CBCommandEventType, handler: (event: CBCommandEvent) => void): ihsm.Disposable;
  events(): AsyncGenerator<CBCommandEvent>;
}

type QueueBinding = {
  cancelQueued(id: string, error: Error): void;
};

class CBCommandRequestImpl implements CBCommandRequest {
  readonly id: string;
  readonly kind: CBCommandKind;
  private readonly slot: CBCommandSlot;
  private readonly queue: QueueBinding;
  private disposed = false;

  constructor(slot: CBCommandSlot, queue: QueueBinding) {
    this.id = slot.id;
    this.kind = slot.kind;
    this.slot = slot;
    this.queue = queue;
  }

  wait(timeoutMs?: number): Promise<CBAnswer> {
    return new Promise<CBAnswer>((resolve, reject) => {
      const subs: ihsm.Disposable[] = [];
      const cleanup = (): void => {
        for (const sub of subs) {
          sub.dispose();
        }
        if (timer !== undefined) {
          clearTimeout(timer);
        }
      };
      subs.push(this.on("answer", (event) => {
        if (event.type === "answer") {
          cleanup();
          resolve(event.answer);
        }
      }));
      subs.push(this.on("error", (event) => {
        if (event.type === "error") {
          cleanup();
          reject(event.error);
        }
      }));
      let timer: ReturnType<typeof setTimeout> | undefined;
      if (timeoutMs !== undefined && timeoutMs > 0) {
        timer = setTimeout(() => {
          cleanup();
          this.dispose();
          reject(new Error(`command ${this.kind} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }
    });
  }

  on(type: CBCommandEventType, handler: (event: CBCommandEvent) => void): ihsm.Disposable {
    return this.slot.on(type, handler);
  }

  async *events(): AsyncGenerator<CBCommandEvent> {
    const pending: CBCommandEvent[] = [];
    let notify: (() => void) | undefined;
    const wake = (): void => { notify?.(); };
    const subs: ihsm.Disposable[] = [
      this.on("notification", (event) => { pending.push(event); wake(); }),
      this.on("answer", (event) => { pending.push(event); wake(); }),
      this.on("error", (event) => { pending.push(event); wake(); }),
    ];
    try {
      for (;;) {
        if (pending.length > 0) {
          const event = pending.shift()!;
          yield event;
          if (event.type === "answer" || event.type === "error") {
            return;
          }
          continue;
        }
        await new Promise<void>((resolve) => { notify = resolve; });
        notify = undefined;
      }
    } finally {
      for (const sub of subs) {
        sub.dispose();
      }
    }
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.queue.cancelQueued(this.id, new Error(`command ${this.kind} disposed`));
  }
}

export function makeCommandRequest(slot: CBCommandSlot, queue: QueueBinding): CBCommandRequest {
  return new CBCommandRequestImpl(slot, queue);
}

/** Await a service call that returns {@link CBCommandRequest}, then wait for the terminal answer. */
export function waitCommand(requestP: Promise<CBCommandRequest>, timeoutMs?: number): Promise<CBAnswer> {
  return requestP.then((request) => request.wait(timeoutMs));
}
