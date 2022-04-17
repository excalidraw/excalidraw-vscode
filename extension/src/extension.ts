import * as vscode from "vscode";
import { ExcalidrawEditorProvider } from "./ExcalidrawEditor";

export async function activate(context: vscode.ExtensionContext) {
  // Register our custom editor providers
  context.subscriptions.push(await ExcalidrawEditorProvider.register(context));
  context.subscriptions.push(ExcalidrawUriHandler.register());
}

class ExcalidrawUriHandler implements vscode.UriHandler {
  public static register() {
    const provider = new ExcalidrawUriHandler();
    const providerRegistration = vscode.window.registerUriHandler(provider);
    return providerRegistration;
  }

  public async handleUri(uri: vscode.Uri) {
    try {
      const hash = new URLSearchParams(uri.fragment);
      const libraryUrl = hash.get("addLibrary");
      const csrfToken = hash.get("token");
      if (libraryUrl && csrfToken && ExcalidrawEditorProvider.activeEditor) {
        ExcalidrawEditorProvider.activeEditor.importLibrary(
          libraryUrl,
          csrfToken
        );
        vscode.window.showInformationMessage("Library added successfully!");
      }
    } catch (e) {
      console.error(e);
    }
  }
}
