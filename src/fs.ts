import path = require("path");
import { TextDecoder } from "util";
import * as vscode from "vscode";

/**
 * Write out the json to a given document.
 */
export function editDoc(
  document: vscode.TextDocument,
  json: string
): Thenable<any> {
  const edit = new vscode.WorkspaceEdit();
  edit.replace(
    document.uri,
    new vscode.Range(0, 0, document.lineCount, 0),
    json
  );
  return vscode.workspace.applyEdit(edit);
}

export async function getWebviewContent(
  templateUri: vscode.Uri,
  documentWebviewUri: vscode.Uri,
  config: {
    theme: "light" | "dark",
    viewModeEnabled?: boolean;
    gridModeEnable?: boolean;
    zenModeEnabled?: boolean;
  }
): Promise<string> {
  const extName = path.extname(documentWebviewUri.fsPath);
  const jsonConfig = JSON.stringify(config);
  const bufferConfig = Buffer.from(jsonConfig, "utf-8");
  const base64Config = bufferConfig.toString("base64");

  let TemplateRaw = await vscode.workspace.fs.readFile(templateUri);
  const html = new TextDecoder()
    .decode(TemplateRaw)
    .replace("{{excalidraw-document-uri}}", documentWebviewUri.toString(true))
    .replace(
      "{{data-document-type}}",
      extName === ".svg" ? "image/svg+xml" : "application/json"
    )
    .replace("{{data-config}}", base64Config)
    .replace("{{data-theme}}", config.theme);

  return html;
}

export function getExportFilename(
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
