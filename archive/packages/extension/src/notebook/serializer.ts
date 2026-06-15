import * as vscode from "vscode";
import { CONCEPTBASE_LANGUAGE_ID, parseMmnbBytes, serializeMmnbCells } from "./mmnb-format";

export function createNotebookSerializer(): vscode.NotebookSerializer {
  return {
    async deserializeNotebook(content: Uint8Array): Promise<vscode.NotebookData> {
      const file = parseMmnbBytes(content);
      const cells = file.cells.map((cell) => {
        const data = new vscode.NotebookCellData(
          vscode.NotebookCellKind.Code,
          cell.value,
          CONCEPTBASE_LANGUAGE_ID
        );
        data.metadata = { mmkitCellId: cell.id };
        return data;
      });
      return new vscode.NotebookData(cells);
    },

    async serializeNotebook(data: vscode.NotebookData): Promise<Uint8Array> {
      const cells = data.cells
        .filter((cell) => cell.kind === vscode.NotebookCellKind.Code)
        .map((cell) => ({
          kind: "code" as const,
          value: cell.value,
          metadata: cell.metadata as { mmkitCellId?: string } | undefined,
        }));
      return serializeMmnbCells(cells);
    },
  };
}

export function registerNotebookSerializer(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.workspace.registerNotebookSerializer("mmkit.conceptbase-notebook", createNotebookSerializer(), {
      transientOutputs: false,
      transientCellMetadata: {},
      transientDocumentMetadata: {},
    })
  );
}
