import * as vscode from "vscode";
import { showEditor, showImage, showSource, updateTheme } from "./commands";
import { ExcalidrawEditorProvider } from "./editor";
import { ExcalidrawUriHandler } from "./uri-handler";

export async function activate(context: vscode.ExtensionContext) {
  // Register our custom editor providers
  context.subscriptions.push(await ExcalidrawEditorProvider.register(context));
  context.subscriptions.push(ExcalidrawUriHandler.register());
  context.subscriptions.push(
    vscode.commands.registerCommand("excalidraw.updateTheme", updateTheme)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("excalidraw.showSource", showSource)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("excalidraw.showEditor", showEditor)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("excalidraw.showImage", showImage)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("excalidraw.showImageToSide", (uri) =>
      showImage(uri, vscode.ViewColumn.Beside)
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("excalidraw.showEditorToSide", (uri) =>
      showEditor(uri, vscode.ViewColumn.Beside)
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("excalidraw.showSourceToSide", (uri) =>
      showSource(uri, vscode.ViewColumn.Beside)
    )
  );
}
