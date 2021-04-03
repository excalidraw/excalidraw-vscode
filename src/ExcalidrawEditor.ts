import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
const open = require("open");

export class ExcalidrawEditorProvider
	implements vscode.CustomTextEditorProvider {
	public static register(context: vscode.ExtensionContext): vscode.Disposable {
		vscode.commands.registerCommand("excalidraw.openInApplication", () => {
			ExcalidrawEditorProvider.openInApplication();
		});
		vscode.commands.registerCommand("excalidraw.export.svg", () => {
			ExcalidrawEditorProvider.exportToIMG("svg");
		});
		vscode.commands.registerCommand("excalidraw.export.png", () => {
			ExcalidrawEditorProvider.exportToIMG("png");
		});

		const provider = new ExcalidrawEditorProvider(context);
		const providerRegistration = vscode.window.registerCustomEditorProvider(
			ExcalidrawEditorProvider.viewType,
			provider
		);
		return providerRegistration;
	}

	private static readonly viewType = "editor.excalidraw";
	public static exportToIMG: Function = () => {
		vscode.window.showErrorMessage(
			"At least one excalidraw editor must be active to use this command!"
		);
	};
	public static openInApplication: Function = () => {
		vscode.window.showErrorMessage(
			"At least one excalidraw editor must be active to use this command!"
		);
	};

	constructor(private readonly context: vscode.ExtensionContext) { }

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

		vscode.commands.executeCommand("setContext", "excalidraw.focused", true);
		webviewPanel.webview.html = this.getHtmlForWebview(document);

		vscode.workspace.onDidChangeConfiguration((e) => {
			if (e.affectsConfiguration("excalidraw.theme")) {
				const theme = vscode.workspace
					.getConfiguration("excalidraw")
					.get("theme", "auto");
				webviewPanel.webview.postMessage({
					type: "refresh-theme",
					theme: theme,
				});
			}
		});

		const openInApplication = () => {
			open(document.uri.fsPath);
		};
		ExcalidrawEditorProvider.openInApplication = openInApplication;

		const exportToIMG = (extension: string) => {
			const exportConfig: any = vscode.workspace
				.getConfiguration("excalidraw")
				.get("exportConfig", {});
			this.getExportFilename(document, extension).then((uri) => {
				if (uri !== undefined)
					webviewPanel.webview.postMessage({
						type: `export-to-${extension}`,
						path: uri.fsPath,
						exportConfig: exportConfig,
					});
			});
		};

		ExcalidrawEditorProvider.exportToIMG = exportToIMG;
		webviewPanel.onDidChangeViewState((e) => {
			if (e.webviewPanel.active) {
				ExcalidrawEditorProvider.exportToIMG = exportToIMG;
				vscode.commands.executeCommand(
					"setContext",
					"excalidraw.focused",
					true
				);
			} else {
				vscode.commands.executeCommand(
					"setContext",
					"excalidraw.focused",
					false
				);
			}
		});

		const updateWebview = () => {
			const { elements, appState } = this.getInitialData(document);
			webviewPanel.webview.postMessage({
				type: "update",
				elements: elements,
				appState: appState,
			});
		};
		const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(
			(e) => {
				if (
					e.document.uri.toString() === document.uri.toString() &&
					e.contentChanges.length > 0
				) {
					updateWebview();
				}
			}
		);

		// Make sure we get rid of the listener when our editor is closed.
		webviewPanel.onDidDispose(() => {
			changeDocumentSubscription.dispose();
		});

		// Receive message from the webview.
		webviewPanel.webview.onDidReceiveMessage((e) => {
			switch (e.type) {
				case "update":
					this.updateTextDocument(document, e.elements, e.appState);
					return;
				case "svg-export":
					fs.writeFile(e.path, e.svg, (err) => {
						if (err) vscode.window.showErrorMessage(err.message);
					});
					return;
				case "png-export":
					var data = e.png.replace(/^data:image\/png;base64,/, "");
					var buf = Buffer.from(data, "base64");
					fs.writeFile(e.path, buf, (err) => {
						if (err) vscode.window.showErrorMessage(err.message);
					});
					return;
				case "refresh-theme":
					const theme = vscode.workspace
						.getConfiguration("excalidraw")
						.get("theme", "auto");
					webviewPanel.webview.postMessage({
						type: "refresh-theme",
						theme: theme,
					});
				case "save":
					document.save();
					return;
				case "log":
					console.log(e.msg);
					return;
			}
		});
	}

	/**
	 * Get the static html used for the editor webviews.
	 */
	private getHtmlForWebview(document: vscode.TextDocument): string {
		const json = this.getInitialData(document);
		const htmlFile = vscode.Uri.joinPath(
			this.context.extensionUri,
			"media",
			"index.html"
		);
		let content = fs.readFileSync(htmlFile.fsPath, "utf8");
		content = content.replace(
			/\$\{initialData\}/,
			`<script>window.initialData = ${JSON.stringify(json)}</script>`
		);

		return content;
	}

	/**
	 * Try to get a current document as json text.
	 */
	private getInitialData(document: vscode.TextDocument): any {
		const text = document.getText();
		const config = vscode.workspace.getConfiguration("excalidraw");
		const themeConfig = config.get("theme", "auto");
		if (text.trim().length === 0) {
			return { elements: [], appState: {}, themeConfig: themeConfig };
		}

		try {
			const json = JSON.parse(text);
			const { elements, appState } = json;
			const initialData = {
				elements: elements,
				appState: appState,
				themeConfig: themeConfig,
			};
			return initialData;
		} catch {
			throw new Error(
				"Could not get document as json. Content is not valid json"
			);
		}
	}

	private getExportFilename(
		document: vscode.TextDocument,
		extension: string
	): Thenable<vscode.Uri | undefined> {
		const dirname = path.dirname(document.uri.fsPath);
		const basename = path.basename(
			document.uri.fsPath,
			path.extname(document.uri.fsPath)
		);
		const filePath = path.join(dirname, `${basename}.${extension}`);
		return vscode.window.showSaveDialog({
			defaultUri: vscode.Uri.file(filePath),
			filters: { Images: [extension] },
		});
	}

	/**
	 * Write out the json to a given document.
	 */
	private updateTextDocument(
		document: vscode.TextDocument,
		elements: Record<string, unknown>,
		appState: Record<string, unknown>
	): Thenable<boolean> {
		const newContent = JSON.stringify(
			{
				type: "excalidraw",
				version: 2,
				source: "https://excalidraw.com",
				elements: elements,
				appState: appState,
			},
			null,
			2
		);

		const edit = new vscode.WorkspaceEdit();

		edit.replace(
			document.uri,
			new vscode.Range(0, 0, document.lineCount, 0),
			newContent
		);

		return vscode.workspace.applyEdit(edit);
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
