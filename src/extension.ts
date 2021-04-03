import * as vscode from "vscode";
import { ExcalidrawEditorProvider } from "./ExcalidrawEditor";

export function activate(context: vscode.ExtensionContext) {
	// Register our custom editor providers
	const setTheme = (theme: string) => {
		vscode.workspace.getConfiguration("excalidraw").update("theme", theme);
	};
	context.subscriptions.push(ExcalidrawEditorProvider.register(context));
	context.subscriptions.push(
		vscode.commands.registerCommand("excalidraw.setTheme.auto", () => {
			setTheme("auto");
		})
	);
	context.subscriptions.push(
		vscode.commands.registerCommand("excalidraw.setTheme.light", () => {
			setTheme("light");
		})
	);
	context.subscriptions.push(
		vscode.commands.registerCommand("excalidraw.setTheme.dark", () => {
			setTheme("dark");
		})
	);
	context.subscriptions.push(
		vscode.commands.registerCommand("excalidraw.export.config", () => {
			updateExportConfig();
		})
	);
}

function updateExportConfig() {
	const exportConfig: any = vscode.workspace
		.getConfiguration("excalidraw")
		.get("exportConfig");
	let {
		exportBackground = true,
		shouldAddWatermark = false,
		exportWithDarkMode = false,
	} = exportConfig;
	const items = [
		{ label: "exportBackground", picked: exportBackground, description: "Indicates whether background should be exported" },
		{ label: "shouldAddWatermark", picked: shouldAddWatermark, description: "Indicates whether watermark should be exported" },
		{ label: "exportWithDarkMode", picked: exportWithDarkMode, description: "Indicates whether to export with dark mode" },
	]
	vscode.window.showQuickPick(items, { canPickMany: true }).then((choices) => {
		if (choices === undefined) return;
		const selected = choices.map((choice) => choice.label);
		vscode.workspace.getConfiguration("excalidraw").update("exportConfig", {
			exportBackground: selected.includes("exportBackground"),
			shouldAddWatermark: selected.includes("shouldAddWatermark"),
			exportWithDarkMode: selected.includes("exportWithDarkMode"),
		});
	});
}
