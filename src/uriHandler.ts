import { URLSearchParams } from "url";
import * as vscode from "vscode";
import { ExcalidrawEditorProvider } from "./ExcalidrawEditor";

class ExcalidrawUriHandler implements vscode.UriHandler {
  public async handleUri(uri: vscode.Uri) {
	console.log(`Handling uri ${uri.toString()}`)
    const hash = new URLSearchParams(uri.fragment);
    const libraryUrl = hash.get("addLibrary");
	const csrfToken = hash.get("token")
    if (libraryUrl && csrfToken) {
      ExcalidrawEditorProvider.lastActiveEditor?.importLibraryUrl(libraryUrl, csrfToken)
    }
  }
}

export function registerProtocolHander() {
  vscode.window.registerUriHandler(new ExcalidrawUriHandler());
}
