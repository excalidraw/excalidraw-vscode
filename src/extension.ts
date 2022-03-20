import * as vscode from "vscode";
import { URLSearchParams } from "url";
import { ExcalidrawTextEditorProvider } from "./ExcalidrawEditor";

export function activate(context: vscode.ExtensionContext) {
	// Register our custom editor providers
	context.subscriptions.push(ExcalidrawTextEditorProvider.register(context), ExcalidrawUriHandler.register());
}


class ExcalidrawUriHandler implements vscode.UriHandler {
	public static register() {
		const provider = new ExcalidrawUriHandler();
		const providerRegistration = vscode.window.registerUriHandler(provider);
		return providerRegistration;
	}

	public async handleUri(uri: vscode.Uri) {
		console.log(`Handling uri ${uri.toString()}`)
		const hash = new URLSearchParams(uri.fragment);
		const libraryUrl = hash.get("addLibrary");
		const csrfToken = hash.get("token")
		if (libraryUrl && csrfToken && ExcalidrawTextEditorProvider.activeEditor) {
			ExcalidrawTextEditorProvider.activeEditor.importLibrary(libraryUrl, csrfToken)
			vscode.window.showInformationMessage("Library added successfully!")
		}
	}
}

