import type { ProgressToken } from "vscode-languageserver/node";
import type { LspActuators } from "../../lsp/ports/lsp-actuators";

/** Tracks a single work-done progress token lifecycle on actuators. */
export class WorkDoneTracker {
  private open = false;

  constructor(
    private readonly actuators: LspActuators,
    private readonly token: ProgressToken
  ) {}

  begin(title: string, cancellable = false): void {
    if (this.open) return;
    this.open = true;
    this.actuators.beginWorkDone(this.token, title, cancellable);
  }

  report(message?: string, percentage?: number): void {
    if (!this.open) return;
    this.actuators.reportWorkDone(this.token, message, percentage);
  }

  end(): void {
    if (!this.open) return;
    this.actuators.endWorkDone(this.token);
    this.open = false;
  }
}
