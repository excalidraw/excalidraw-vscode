import * as vscode from "vscode";
import * as path from "path";

export function getActiveWorkspace() {
  const activeEditor = vscode.window.activeTextEditor;
  if (activeEditor) {
    const doc = activeEditor.document;
    const ws = vscode.workspace.getWorkspaceFolder(doc.uri);
    return ws;
  }

  const wsf = vscode.workspace.workspaceFolders;
  if (wsf && wsf.length > 0) {
    const ws = wsf[0];
    return ws;
  }
  return undefined;
}

let runningCounter = 0;

export async function newUntitledExcalidrawDocument() {
  runningCounter += 1;
  const ws = getActiveWorkspace();
  let fileName = `Untitled-${runningCounter}.excalidraw`;
  if (ws) {
    fileName = path.join(ws.uri.fsPath, fileName);
  }
  const uri = vscode.Uri.parse(`untitled:${fileName}`);
  await vscode.commands.executeCommand(
    "vscode.openWith",
    uri,
    "editor.excalidraw"
  );
}
