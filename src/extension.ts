import * as vscode from 'vscode';
import { ExcalidrawEditorProvider } from './ExcalidrawEditor';

export function activate(context: vscode.ExtensionContext) {
	// Register our custom editor providers
	context.subscriptions.push(ExcalidrawEditorProvider.register(context));
}
