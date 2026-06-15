import * as vscode from "vscode";
import type { UiPort } from "../types";

export class RealUiPort implements UiPort {
  private progress?: vscode.Progress<{ message?: string; increment?: number }>;
  private resolve?: () => void;
  private lastPercent = 0;

  showInstallProgress(title: string): void {
    if (this.progress) return;
    this.lastPercent = 0;
    void vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title,
        cancellable: false,
      },
      async (progress) => {
        this.progress = progress;
        await new Promise<void>((resolve) => {
          this.resolve = resolve;
        });
      }
    );
  }

  hideInstallProgress(): void {
    this.resolve?.();
    this.resolve = undefined;
    this.progress = undefined;
    this.lastPercent = 0;
  }

  reportInstallProgress(message: string, percent: number): void {
    const clamped = Math.min(100, Math.max(this.lastPercent, percent));
    const increment = clamped - this.lastPercent;
    this.lastPercent = clamped;
    if (increment > 0) {
      this.progress?.report({ message, increment });
    } else {
      this.progress?.report({ message });
    }
  }
}
