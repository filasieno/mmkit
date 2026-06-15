import type * as ihsm from "ihsm";

/** Progress while the supervisor leaves {@link Uninitialized} and reaches {@link Stopped}. */
export type CBServerInitializeNotificationEvent = { readonly type: "notification"; readonly state: string };

/** Terminal success — supervisor mailbox wired and idle detached state reached. */
export type CBServerInitializeAnswerEvent = { readonly type: "answer"; readonly state: string };

export type CBServerInitializeErrorEvent = { readonly type: "error"; readonly error: Error };

export type CBServerInitializeTerminalEvent = CBServerInitializeAnswerEvent | CBServerInitializeErrorEvent;
export type CBServerInitializeEvent = CBServerInitializeNotificationEvent | CBServerInitializeTerminalEvent;
export type CBServerInitializeEventType = CBServerInitializeEvent["type"];

/** Mutable slot for a single in-flight `initialize()` call. */
export class CBServerInitializeSlot {
  private terminated = false;
  private terminalEvent?: CBServerInitializeTerminalEvent;
  private readonly handlers = new Set<(event: CBServerInitializeEvent) => void>();

  get isTerminated(): boolean {
    return this.terminated;
  }

  getTerminalState(): string | undefined {
    if (this.terminalEvent?.type === "answer") {
      return this.terminalEvent.state;
    }
    return undefined;
  }

  getTerminalError(): Error | undefined {
    if (this.terminalEvent?.type === "error") {
      return this.terminalEvent.error;
    }
    return undefined;
  }

  on(type: CBServerInitializeEventType, handler: (event: CBServerInitializeEvent) => void): ihsm.Disposable {
    const wrapped = (event: CBServerInitializeEvent): void => {
      if (event.type === type) {
        handler(event);
      }
    };
    this.handlers.add(wrapped);
    if (this.terminated && this.terminalEvent !== undefined && this.terminalEvent.type === type) {
      wrapped(this.terminalEvent);
    }
    return { dispose: () => { this.handlers.delete(wrapped); } };
  }

  private emit(event: CBServerInitializeEvent): void {
    for (const handler of this.handlers) {
      handler(event);
    }
  }

  emitNotification(state: string): void {
    if (this.terminated) {
      return;
    }
    this.emit({ type: "notification", state });
  }

  terminateAnswer(state: string): void {
    if (this.terminated) {
      return;
    }
    this.terminated = true;
    const event: CBServerInitializeAnswerEvent = { type: "answer", state };
    this.terminalEvent = event;
    this.emit(event);
    this.handlers.clear();
  }

  terminateError(error: Error): void {
    if (this.terminated) {
      return;
    }
    this.terminated = true;
    const event: CBServerInitializeErrorEvent = { type: "error", error };
    this.terminalEvent = event;
    this.emit(event);
    this.handlers.clear();
  }
}

export interface CBServerInitializeRequest extends ihsm.Disposable {
  wait(timeoutMs?: number): Promise<string>;
  on(type: CBServerInitializeEventType, handler: (event: CBServerInitializeEvent) => void): ihsm.Disposable;
  events(): AsyncGenerator<CBServerInitializeEvent>;
}

class CBServerInitializeRequestImpl implements CBServerInitializeRequest {
  private readonly slot: CBServerInitializeSlot;
  private disposed = false;

  constructor(slot: CBServerInitializeSlot) {
    this.slot = slot;
  }

  wait(timeoutMs?: number): Promise<string> {
    const terminalState = this.slot.getTerminalState();
    if (terminalState !== undefined) {
      return Promise.resolve(terminalState);
    }
    const terminalError = this.slot.getTerminalError();
    if (terminalError !== undefined) {
      return Promise.reject(terminalError);
    }
    return new Promise<string>((resolve, reject) => {
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
          resolve(event.state);
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
          reject(new Error(`server initialize timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }
    });
  }

  on(type: CBServerInitializeEventType, handler: (event: CBServerInitializeEvent) => void): ihsm.Disposable {
    return this.slot.on(type, handler);
  }

  async *events(): AsyncGenerator<CBServerInitializeEvent> {
    const pending: CBServerInitializeEvent[] = [];
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
    this.slot.terminateError(new Error("server initialize disposed"));
  }
}

export function makeServerInitializeRequest(slot: CBServerInitializeSlot): CBServerInitializeRequest {
  return new CBServerInitializeRequestImpl(slot);
}

/** Await `initialize()` then wait for the terminal supervisor state. */
export function waitInitialize(requestP: Promise<CBServerInitializeRequest>, timeoutMs?: number): Promise<string> {
  return requestP.then((request) => request.wait(timeoutMs));
}
