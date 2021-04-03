import * as vscode from 'vscode';
import { ExcalidrawEditorProvider } from './ExcalidrawEditor';

export function activate(context: vscode.ExtensionContext) {
	// Register our custom editor providers
	const setTheme = (theme: string) => {
		vscode.workspace.getConfiguration('excalidraw').update('theme', theme)
	}
	context.subscriptions.push(ExcalidrawEditorProvider.register(context));
	context.subscriptions.push(vscode.commands.registerCommand("excalidraw.setTheme.auto", () => {
		setTheme("auto")
	}))
	context.subscriptions.push(vscode.commands.registerCommand("excalidraw.setTheme.light", () => {
		setTheme("light")
	}))
	context.subscriptions.push(vscode.commands.registerCommand("excalidraw.setTheme.dark", () => {
		setTheme("dark")
	}))
	context.subscriptions.push(vscode.commands.registerCommand("excalidraw.export.config", () => {
		updateExportConfig()
	}))
}

function updateExportConfig() {
	const exportConfig: any = vscode.workspace.getConfiguration('excalidraw').get('exportConfig')
	let { exportBackground, viewBackgroundColor, shouldAddWatermark, exportWithDarkMode } = exportConfig
	const items = Object.entries({ exportBackground: exportBackground, shouldAddWatermark: shouldAddWatermark, exportWithDarkMode: exportWithDarkMode }).map(([k, v]) => ({ label: k, picked: !!v }))
	vscode.window.showQuickPick(items, { canPickMany: true }).then(choices => {
		if (choices === undefined)
			return
		const selected = choices.map(choice => choice.label)
		vscode.workspace.getConfiguration('excalidraw').update('exportConfig', {
			viewBackgroundColor: viewBackgroundColor,
			exportBackground: selected.includes("exportBackground"),
			shouldAddWatermark: selected.includes("shouldAddWatermark"),
			exportWithDarkMode: selected.includes("exportWithDarkMode")
		})
	})
}
