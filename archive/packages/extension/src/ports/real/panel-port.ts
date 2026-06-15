import type { PanelInteraction, PanelViewModel } from "../../types";
import type { PanelPort } from "../types";

/** Bridges WebviewViewProvider — set by extension before panel actor enables. */
export interface PanelPortBridge {
  postViewModel(viewModel: PanelViewModel): void;
  onInteraction(handler: (interaction: PanelInteraction) => void): () => void;
  isVisible(): boolean;
}

let bridge: PanelPortBridge | undefined;

export function setPanelPortBridge(next: PanelPortBridge | undefined): void {
  bridge = next;
}

export class RealPanelPort implements PanelPort {
  async render(viewModel: PanelViewModel): Promise<void> {
    bridge?.postViewModel(viewModel);
  }

  onInteraction(handler: (interaction: PanelInteraction) => void): () => void {
    if (!bridge) return () => undefined;
    return bridge.onInteraction(handler);
  }

  isVisible(): boolean {
    return bridge?.isVisible() ?? false;
  }
}
