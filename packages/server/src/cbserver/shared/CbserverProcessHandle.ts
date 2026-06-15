import type { ChildProcess } from "node:child_process";
import type * as ihsm from "ihsm";
import type { CBServerMachineConfig } from "../actors/server/CBServerConfig";

/** Process stdio and lifecycle notifications wired by {@link CbserverProcessHandle}. */
export type CbChildProcessNotify = ihsm.InboundActor<CBServerMachineConfig>["notify"];

/**
 * Wires a spawned {@link ChildProcess} to ihsm notifications and reaps it on dispose.
 * Listeners are registered in the constructor — same synchronous turn as `spawn()`.
 */
export class CbserverProcessHandle implements ihsm.Disposable {
  private disposed = false;

  constructor( private readonly child: ChildProcess, notify: CbChildProcessNotify, private readonly onKill: (pid: number) => void ) {
    this.wireStdio( this.child.stdout, { onData: (chunk) => notify.onStdoutData(chunk), onEnd: () => notify.onStdoutEnd(), onClose: () => notify.onStdoutClose(), onError: (message) => notify.onStdoutStdioError(message), } );
    this.wireStdio( this.child.stderr, { onData: (chunk) => notify.onStderrData(chunk), onEnd: () => notify.onStderrEnd(), onClose: () => notify.onStderrClose(), onError: (message) => notify.onStderrStdioError(message), } );

    this.child.once( "exit", (code, signal) => { notify.onProcessExit(code, signal); } );
    this.child.once( "close", (code, signal) => { notify.onProcessClose(code, signal); } );
    this.child.once( "error", (err) => { notify.onProcessError(String(err)); } );
    this.child.once( "disconnect", () => { notify.onDisconnect(); } );
  }

  private wireStdio( stream: NodeJS.ReadableStream | null | undefined, handlers: { onData: (chunk: string) => void; onEnd: () => void; onClose: () => void; onError: (message: string) => void; } ): void {
    stream?.on( "data", (chunk: Buffer) => { handlers.onData(chunk.toString("utf8")); } );
    stream?.once("end", handlers.onEnd);
    stream?.once("close", handlers.onClose);
    stream?.once( "error", (err) => { handlers.onError(String(err)); } );
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.child.stdout?.removeAllListeners();
    this.child.stderr?.removeAllListeners();
    this.child.stdin?.removeAllListeners();
    this.child.removeAllListeners("exit");
    this.child.removeAllListeners("close");
    this.child.removeAllListeners("error");
    this.child.removeAllListeners("disconnect");

    const pid: number | undefined = this.child.pid;
    if (pid !== undefined && this.child.exitCode === null && this.child.signalCode === null && !this.child.killed) {
      this.onKill(pid);
    }
  }
}
