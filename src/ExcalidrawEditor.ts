import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
var minimatch = require('minimatch')



/**
 * Provider for cat scratch editors.
 * 
 * Cat scratch editors are used for `.cscratch` files, which are just json files.
 * To get started, run this extension and open an empty `.cscratch` file in VS Code.
 * 
 * This provider demonstrates:
 * 
 * - Setting up the initial webview for a custom editor.
 * - Loading scripts and styles in a custom editor.
 * - Synchronizing changes between a text document and a custom editor.
 */
export class ExcalidrawEditorProvider implements vscode.CustomTextEditorProvider {

	public static register(context: vscode.ExtensionContext): vscode.Disposable {
		const setTheme = (theme: string) => {
			vscode.workspace.getConfiguration('excalidraw').update('theme', theme)
		}
		vscode.commands.registerCommand("excalidraw.export.svg", () => {
			ExcalidrawEditorProvider.exportToSVG()
		})
		vscode.commands.registerCommand("excalidraw.export.png", () => {
			ExcalidrawEditorProvider.exportToPNG()
		})
		vscode.commands.registerCommand("excalidraw.setTheme.auto", () => {
			setTheme("auto")
		})
		vscode.commands.registerCommand("excalidraw.setTheme.light", () => {
			setTheme("light")
		})
		vscode.commands.registerCommand("excalidraw.setTheme.dark", () => {
			setTheme("dark")
		})

		const provider = new ExcalidrawEditorProvider(context);
		const providerRegistration = vscode.window.registerCustomEditorProvider(ExcalidrawEditorProvider.viewType, provider);
		return providerRegistration;
	}

	private static readonly viewType = 'editor.excalidraw';
	public static exportToSVG: Function = () => {
		throw Error("Not defined")
	}
	public static exportToPNG: Function = () => {
		throw Error("Not defined")
	}

	constructor(
		private readonly context: vscode.ExtensionContext
	) { }

	/**
	 * Called when our custom editor is opened.
	 * 
	 * 
	 */
	public async resolveCustomTextEditor(
		document: vscode.TextDocument,
		webviewPanel: vscode.WebviewPanel,
		_token: vscode.CancellationToken
	): Promise<void> {
		// Setup initial content for the webview
		webviewPanel.webview.options = {
			enableScripts: true,
		};
		vscode.commands.executeCommand('setContext', 'excalidraw.focused', true);

		vscode.workspace.onDidChangeConfiguration((e) => {
			if (e.affectsConfiguration('excalidraw.theme')) {
				const theme = vscode.workspace.getConfiguration('excalidraw').get("theme")
				webviewPanel.webview.postMessage({ type: 'refresh-theme', theme: theme })
			}
		})


		webviewPanel.webview.html = this.getHtmlForWebview(document);

		const updateWebview = () => {
			const { elements, appState } = this.getInitialData(document)
			webviewPanel.webview.postMessage({
				type: 'update',
				elements: elements, appState: appState,
			});
		};
		const exportToSvg = () => {
			const exportConfig: any = vscode.workspace.getConfiguration("excalidraw").get("exportConfig")
			const { globs = {}, ...exportParams } = exportConfig;
			const dirname = this.getExportDirname(document, globs)
			webviewPanel.webview.postMessage({ type: "export-to-svg", dirname: dirname, exportParams: exportParams })
		}
		ExcalidrawEditorProvider.exportToSVG = exportToSvg
		const exportToPng = () => {
			const exportConfig: any = vscode.workspace.getConfiguration("excalidraw").get("exportConfig")
			const { globs = {}, ...exportParams } = exportConfig;
			const dirname = this.getExportDirname(document, globs)
			webviewPanel.webview.postMessage({ type: "export-to-png", dirname: dirname, exportParams: exportParams })
		}
		ExcalidrawEditorProvider.exportToPNG = exportToPng

		webviewPanel.onDidChangeViewState(e => {
			if (e.webviewPanel.active) {
				ExcalidrawEditorProvider.exportToSVG = exportToSvg
				ExcalidrawEditorProvider.exportToPNG = exportToPng
				vscode.commands.executeCommand('setContext', 'excalidraw.focused', true);
			} else {
				vscode.commands.executeCommand('setContext', 'excalidraw.focused', false);
			}
		})
		// Hook up event handlers so that we can synchronize the webview with the text document.
		//
		// The text document acts as our model, so we have to sync change in the document to our
		// editor and sync changes in the editor back to the document.
		// 
		// Remember that a single text document can also be shared between multiple custom
		// editors (this happens for example when you split a custom editor)

		const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
			if (e.document.uri.toString() === document.uri.toString() && e.contentChanges.length > 0) {
				updateWebview();
			}
		});

		// Make sure we get rid of the listener when our editor is closed.
		webviewPanel.onDidDispose(() => {
			changeDocumentSubscription.dispose();
		});

		// Receive message from the webview.
		webviewPanel.webview.onDidReceiveMessage(e => {
			let basename
			let filePath
			switch (e.type) {
				case 'update':
					this.updateTextDocument(document, e.elements, e.appState);
					return;
				case 'svg-export':
					basename = path.basename(document.uri.fsPath, path.extname(document.uri.fsPath))
					filePath = path.join(e.dirname, basename + ".svg")
					fs.writeFile(filePath, e.svg, (err) => { if (err) vscode.window.showErrorMessage(err.message) });
					return;
				case 'png-export':
					basename = path.basename(document.uri.fsPath, path.extname(document.uri.fsPath))
					filePath = path.join(e.dirname, basename + ".png")

					var data = e.png.replace(/^data:image\/png;base64,/, "");
					var buf = Buffer.from(data, 'base64');
					fs.writeFile(filePath, buf, (err) => { if (err) vscode.window.showErrorMessage(err.message) });
					return;
				case 'refresh-theme':
					const theme = vscode.workspace.getConfiguration('excalidraw').get('theme')
					webviewPanel.webview.postMessage({ type: 'refresh-theme', theme: theme })
				case 'save':
					this.saveTextDocument(document, exportToPng, exportToSvg)
					return
				case 'log':
					console.log(e.msg);
					return;
			}
		});


	}

	/**
	 * Get the static html used for the editor webviews.
	 */
	private getHtmlForWebview(document: vscode.TextDocument): string {
		const json = this.getInitialData(document)
		const htmlFile = vscode.Uri.joinPath(this.context.extensionUri, 'media', 'index.html');
		let content = fs.readFileSync(htmlFile.fsPath, "utf8");
		content = content.replace(/\$\{initialData\}/, `<script>window.initialData = ${JSON.stringify(json)}</script>`)

		return content
	}

	/**
	 * Try to get a current document as json text.
	 */
	private getInitialData(document: vscode.TextDocument): any {
		const text = document.getText();
		const config = vscode.workspace.getConfiguration('excalidraw')
		const themeConfig = config.get('theme')
		const exportConfig = config.get('export')
		if (text.trim().length === 0) {
			return { elements: [], appState: {}, themeConfig: themeConfig };
		}

		try {
			const json = JSON.parse(text)
			const { elements, appState } = json
			const initialData = { elements: elements, appState: appState, themeConfig: themeConfig, exportConfig: exportConfig };
			return initialData
		} catch {
			throw new Error('Could not get document as json. Content is not valid json');
		}
	}

	private saveTextDocument(document: vscode.TextDocument, exportToPNG: Function, exportToSVG: Function) {
		document.save()

		const exportOnSaveConfig: any = vscode.workspace.getConfiguration("excalidraw").get("exportOnSave")
		if (exportOnSaveConfig.enabled) {
			switch (exportOnSaveConfig.extension) {
				case "svg":
					exportToSVG()
					return;
				case "png":
					exportToPNG()
					return;
			}
		}
	}

	private getExportDirname(document: vscode.TextDocument, globs: any) {
		const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri)
		if (workspaceFolder === undefined || globs === undefined)
			return path.dirname(document.uri.fsPath)
		for (let [pattern, dirname] of Object.entries(globs)) {
			if (minimatch(document.uri.fsPath, pattern) && typeof dirname === 'string') {
				return path.join(workspaceFolder.uri.fsPath, dirname)
			}
		}
		return path.dirname(document.uri.fsPath)
	}


	/**
	 * Write out the json to a given document.
	 */
	private updateTextDocument(document: vscode.TextDocument, elements: Record<string, unknown>, appState: Record<string, unknown>) {
		const newContent = JSON.stringify({
			"type": "excalidraw",
			"version": 2,
			"source": "https://excalidraw.com",
			"elements": elements,
			"appState": appState
		}, null, 2)

		const edit = new vscode.WorkspaceEdit();

		// Just replace the entire document every time for this example extension.
		// A more complete extension should compute minimal edits instead.
		edit.replace(
			document.uri,
			new vscode.Range(0, 0, document.lineCount, 0),
			newContent);

		return vscode.workspace.applyEdit(edit)

	}
}

export const debounce = <T extends (...args: any[]) => any>(
	callback: T,
	waitFor: number
) => {
	let timeout: ReturnType<typeof setTimeout>;
	return (...args: Parameters<T>): ReturnType<T> => {
		let result: any;
		timeout && clearTimeout(timeout);
		timeout = setTimeout(() => {
			result = callback(...args);
		}, waitFor);
		return result;
	};
};
