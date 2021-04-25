import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as open from "open";
import * as minimatch from "minimatch";

export class ExcalidrawEditorProvider implements vscode.CustomTextEditorProvider {
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

	constructor(private readonly context: vscode.ExtensionContext) {}

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
		webviewPanel.webview.html = this.getHtmlForWebview(document);

		const refreshTheme = () => {
			const theme = vscode.workspace
				.getConfiguration("excalidraw")
				.get("theme", "auto");
			webviewPanel.webview.postMessage({
				type: "refresh-theme",
				theme: theme,
			});
		};
		const changeConfigurationSubscription = vscode.workspace.onDidChangeConfiguration(
			(e) => {
				if (e.affectsConfiguration("excalidraw.theme")) {
					refreshTheme();
				}
			}
		);

		const openInApplication = () => {
			open(document.uri.fsPath);
		};
		ExcalidrawEditorProvider.openInApplication = openInApplication;

		const exportToIMG = (extension: string) => {
			const exportConfig = vscode.workspace.getConfiguration(
				"excalidraw.export"
			);
			this.getExportFilename(document, extension).then((uri) => {
				if (uri !== undefined)
					webviewPanel.webview.postMessage({
						type: `export-to-${extension}`,
						path: uri.fsPath,
						exportConfig: {
							exportBackground: exportConfig.get("exportBackground"),
							shouldAddWatermark: exportConfig.get("shouldAddWatermark"),
							exportWithDarkMode: exportConfig.get("exportWithDarkMode"),
						},
					});
			});
		};

		ExcalidrawEditorProvider.exportToIMG = exportToIMG;
		webviewPanel.onDidChangeViewState((e) => {
			if (document.uri.scheme === "git") return;
			if (e.webviewPanel.active) {
				ExcalidrawEditorProvider.exportToIMG = exportToIMG;
				refreshTheme();
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
			changeConfigurationSubscription.dispose();
		});

		// Receive message from the webview.
		webviewPanel.webview.onDidReceiveMessage((e) => {
			switch (e.type) {
				case "init":
					vscode.commands.executeCommand(
						"setContext",
						"excalidraw.focused",
						true
					);
					return;
				case "library":
					this.context.globalState.update("libraryItems", e.items)
					break;
				case "update":
					this.updateTextDocument(document, e.elements, e.appState);
					return;
				case "svg-export":
					createDirIfNeeded(e.path)
					fs.writeFile(e.path, e.svg, (err) => {
						if (err) vscode.window.showErrorMessage(err.message);
						else vscode.window.showInformationMessage(`Export Successful`, "Open").then(msg => {
							if (msg === "Open")
								vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(e.path))
						});
					});
					return;
				case "png-export":
					createDirIfNeeded(e.path)
					var data = e.png.replace(/^data:image\/png;base64,/, "");
					var buf = Buffer.from(data, "base64");
					fs.writeFile(e.path, buf, (err) => {
						if (err) vscode.window.showErrorMessage(err.message);
						else vscode.window.showInformationMessage(`Export Successful`, "Open").then(msg => {
							if (msg === "Open")
								vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(e.path))
						});
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
		const initialData = this.getInitialData(document);
		const htmlFile = vscode.Uri.joinPath(
			this.context.extensionUri,
			"media",
			"index.html"
		);
		let content = fs.readFileSync(htmlFile.fsPath, "utf8");
		if (initialData.readOnly)
			content = content.replace(
				/(<style>)(<\/style>)/,
				`$1
			.Island {
				display: none !important;
			}
			$2`
			);

		content = content.replace(
			/\$\{initialData\}/,
			`<script>window.initialData = ${JSON.stringify(initialData)}</script>`
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
		const libraryItems = this.context.globalState.get("libraryItems", [])

		if (text.trim().length === 0) {
			return { elements: [], appState: {}, themeConfig: themeConfig, libraryItems: libraryItems };
		}

		try {
			const json = JSON.parse(text);
			const { elements, appState } = json;
			const initialData = {
				elements: elements,
				appState: { ...appState },
				libraryItems: libraryItems,
				themeConfig: themeConfig,
				readOnly: document.uri.scheme === "git"
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
				const globs: any = vscode.workspace
						.getConfiguration("excalidraw.export")
						.get("globs");
				const worskspaceFolder = vscode.workspace.workspaceFolders?.[0];
				for (const [glob, outputDir] of Object.entries(globs)) {
						if (minimatch(document.uri.fsPath, glob))
								return new Promise((resolve) => {
										if (worskspaceFolder === undefined || typeof outputDir != "string")
												resolve(undefined);
										else {
												const outputPath = path.join(
														worskspaceFolder.uri.fsPath,
														outputDir,
														`${basename}.${extension}`
												);
												resolve(vscode.Uri.parse(outputPath));
										}
								});
				}
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

function createDirIfNeeded(filepath:string) {
	const dirname = path.dirname(filepath)
	if (!fs.existsSync(dirname))
		fs.mkdirSync(dirname, {recursive: true})
}
