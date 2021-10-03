import * as vscode from "vscode";
import { ExcalidrawEditorProvider } from "./ExcalidrawEditor";
import { registerProtocolHander } from "./uriHandler";
import * as open from "open"

export function activate(context: vscode.ExtensionContext) {
	// Register our custom editor providers
	ExcalidrawEditorProvider.register(context);
	registerProtocolHander()

	context.subscriptions.push(
		vscode.commands.registerCommand("excalidraw.exportConfig", updateExportConfig)
	);
	context.subscriptions.push(
		vscode.commands.registerCommand("excalidraw.selectTheme", updateThemeConfig)
	)
	context.subscriptions.push(
		vscode.commands.registerCommand("excalidraw.openInApp", () => {
			const excalidrawEditor = ExcalidrawEditorProvider.lastActiveEditor
			if (excalidrawEditor && excalidrawEditor.active)
				open(excalidrawEditor.document.uri.fsPath)
		})
	)
}

function updateThemeConfig() {
	vscode.window
		.showQuickPick([
			{ label: "auto", description: "Sync theme with vscode" },
			{ label: "light", description: "Always use light theme" },
			{ label: "dark", description: "Always use dark theme" },
		])
		.then((theme) => {
			if (theme !== undefined)
				vscode.workspace
					.getConfiguration("excalidraw")
					.update("theme", theme.label);
		});
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
			label: "exportWithDarkMode",
			picked: !!exportConfig.get("exportWithDarkMode"),
			description: "Indicates whether to export with dark mode",
		},
		{
			label: "exportEmbedScene",
			picked: !!exportConfig.get("exportEmbedScene"),
			description: "Indicates whether scene data should be embedded in svg.",
		},
	];

	vscode.window.showQuickPick(items, { canPickMany: true }).then((choices) => {
		if (choices === undefined) return;
		const selected = choices.map((choice) => choice.label);
		exportConfig.update("exportBackground", selected.includes("exportBackground"))
		exportConfig.update("exportWithDarkMode", selected.includes("exportWithDarkMode"))
		exportConfig.update("exportEmbedScene", selected.includes("exportEmbedScene"))
	});
}
