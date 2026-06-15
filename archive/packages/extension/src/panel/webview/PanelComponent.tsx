import type { PanelActionViewModel, PanelViewModel } from "../../types";

export interface PanelComponentProps {
  readonly viewModel: PanelViewModel;
  readonly onAction: (actionId: string) => void;
  readonly onKeyDown: (key: string, actionId?: string) => void;
}

/** Pure functional panel UI — behaviour is injected via callbacks. */
export function PanelComponent({ viewModel, onAction, onKeyDown }: PanelComponentProps): JSX.Element {
  return (
    <div className="mmkit-panel" onKeyDown={(e) => onKeyDown(e.key)}>
      <header className="mmkit-panel__header">
        <h2 className="mmkit-panel__title">{viewModel.title}</h2>
        <p className="mmkit-panel__status">{viewModel.statusMessage}</p>
        <p className="mmkit-panel__meta">
          Trace: {viewModel.traceLevel}
          {viewModel.statusMessage !== "Loading…" && !viewModel.snapshotValid ? " · invalid configuration" : ""}
        </p>
      </header>
      <section className="mmkit-panel__actions" aria-label="mmkit actions">
        {viewModel.actions.map((action: PanelActionViewModel) => (
          <button
            key={action.id}
            type="button"
            className={`mmkit-panel__btn mmkit-panel__btn--${action.variant ?? "secondary"}`}
            disabled={!action.enabled}
            onClick={() => onAction(action.id)}
            data-action-id={action.id}
          >
            {action.label}
          </button>
        ))}
      </section>
    </div>
  );
}
