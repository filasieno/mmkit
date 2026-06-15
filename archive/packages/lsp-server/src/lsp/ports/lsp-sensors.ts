export type CancelListener = (requestId: string | number) => void;

export interface LspSensors {
  onCancel(listener: CancelListener): () => void;
  emitCancel(requestId: string | number): void;
}

export function createLspSensors(): LspSensors {
  const listeners = new Set<CancelListener>();
  return {
    onCancel(listener: CancelListener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    emitCancel(requestId: string | number) {
      for (const listener of listeners) listener(requestId);
    },
  };
}
