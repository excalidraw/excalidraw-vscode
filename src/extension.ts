import * as vscode from "vscode";
import { ExcalidrawEditorProvider } from "./ExcalidrawEditor";

export function activate(context: vscode.ExtensionContext) {
	// Register our custom editor providers
	context.subscriptions.push(ExcalidrawEditorProvider.register(context));
	context.subscriptions.push(
		vscode.commands.registerCommand("excalidraw.theme.config", () => {
			const config = vscode.workspace.getConfiguration("excalidraw");
			const originalTheme = config.get("theme");
			vscode.window
				.showQuickPick([
					{ label: "auto", description: "Sync theme with vscode" },
					{ label: "light", description: "Always use light theme" },
					{ label: "dark", description: "Always use dark theme" },
				], {
					onDidSelectItem: item => {
						config.update("theme", typeof item === 'string' ? item : item.label)
					}
				})
				.then((theme) => {
					if (theme !== undefined)
						vscode.workspace
							.getConfiguration("excalidraw")
							.update("theme", theme.label);
					else
						config.update("theme", originalTheme)
				}, () => {
					config.update("theme", originalTheme)
				});
		})
	);
	context.subscriptions.push(
		vscode.commands.registerCommand("excalidraw.export.config", () => {
			updateExportConfig();
		})
	);
}

function updateExportConfig() {
	const exportConfig = vscode.workspace.getConfiguration("excalidraw.export")
	const items = [
		{
			label: "exportBackground",
			picked: !!exportConfig.get("exportBackground"),
			description: "Indicates whether background should be exported",
		},
		{
			label: "shouldAddWatermark",
			picked: !!exportConfig.get("shouldAddWatermark"),
			description: "Indicates whether watermark should be exported",
		},
		{
			label: "exportWithDarkMode",
			picked: !!exportConfig.get("exportWithDarkMode"),
			description: "Indicates whether to export with dark mode",
		},
	];
	vscode.window.showQuickPick(items, { canPickMany: true }).then((choices) => {
		if (choices === undefined) return;
		const selected = choices.map((choice) => choice.label);
		exportConfig.update("exportBackground", selected.includes("exportBackground"))
		exportConfig.update("shouldAddWatermark", selected.includes("shouldAddWatermark"))
		exportConfig.update("exportWithDarkMode", selected.includes("exportWithDarkMode"))
	});
}
