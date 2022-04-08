import * as vscode from "vscode";
import { ExcalidrawTextEditorProvider } from "./ExcalidrawEditor";

export function activate(context: vscode.ExtensionContext) {
	// Register our custom editor providers
	context.subscriptions.push(ExcalidrawTextEditorProvider.register(context));
	context.subscriptions.push(ExcalidrawUriHandler.register());
	context.subscriptions.push(ExcalidrawCommands.register());
}


class ExcalidrawUriHandler implements vscode.UriHandler {
	public static register() {
		const provider = new ExcalidrawUriHandler();
		const providerRegistration = vscode.window.registerUriHandler(provider);
		return providerRegistration;
	}

	public async handleUri(uri: vscode.Uri) {
		console.log(`Handling uri ${uri.toString()}`)
		try {
			const hash = new URLSearchParams(uri.fragment);
			const libraryUrl = hash.get("addLibrary");
			const csrfToken = hash.get("token")
			console.log(libraryUrl, csrfToken)
			if (libraryUrl && csrfToken && ExcalidrawTextEditorProvider.activeEditor) {
				ExcalidrawTextEditorProvider.activeEditor.importLibrary(libraryUrl, csrfToken)
				vscode.window.showInformationMessage("Library added successfully!")
			}
		} catch (e) {
			console.error(e);
		}
	}
}

class ExcalidrawCommands {
	public static register() {
		return vscode.commands.registerCommand('excalidraw.file.new', () => {
            const resourceSet = new Set<string>();
            vscode.workspace.textDocuments.forEach(document => {
                resourceSet.add(document.uri.toString());
            });

            let counter = 1;
            let untitledResource: vscode.Uri;
            do {
				untitledResource = vscode.Uri.from({ scheme: 'untitled', path: `Excalidraw-${counter}.excalidraw` });
                counter++;
            } while (resourceSet.has(untitledResource.toString()));
            
			vscode.commands.executeCommand(
				'vscode.openWith',
				untitledResource,
				'editor.excalidraw'
			);
		});
	}
}