import { TextDecoder, TextEncoder } from "util";
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

export async function loadWebviewContent(
  uri: vscode.Uri,
  documentUri: vscode.Uri,
  documentType: "application/json" | "image/svg" = "application/json"
): Promise<string> {
  let raw = await vscode.workspace.fs.readFile(uri);
  // if (initialData.readOnly)
  //   content = new TextDecoder().decode(raw).replace(
  //     /(<style>)(<\/style>)/,
  //     `$1
  // 		.Island {
  // 			display: none !important;
  // 		}
  // 		$2`
  //   );

  const html = new TextDecoder()
    .decode(raw)
    .replace("{{excalidraw-document-uri}}", documentUri.toString(true))
	.replace("{{excalidraw-document-type}}", documentType)
  return html;
}

// function getExportFilename(
//       document: vscode.TextDocument,
//       extension: string
//     ): Thenable<vscode.Uri | undefined> {
//       const dirname = vscode.Uri.parse() path.dirname(document.uri.fsPath);
//       const basename = path.basename(
//         document.uri.fsPath,
//         path.extname(document.uri.fsPath)
//       );
//       const globs: any = vscode.workspace
//         .getConfiguration("excalidraw.export")
//         .get("globs");
//       const worskspaceFolder = vscode.workspace.workspaceFolders?.[0];
//       for (const [glob, outputDir] of Object.entries(globs)) {
//         if (minimatch(document.uri.fsPath, glob))
//           return new Promise((resolve) => {
//             if (worskspaceFolder === undefined || typeof outputDir != "string")
//               resolve(undefined);
//             else {
//               const outputPath = path.join(
//                 worskspaceFolder.uri.fsPath,
//                 outputDir,
//                 `${basename}.${extension}`
//               );
//               resolve(vscode.Uri.parse(outputPath));
//             }
//           });
//       }
//       const filePath = path.join(dirname, `${basename}.${extension}`);
//       return vscode.window.showSaveDialog({
//         defaultUri: vscode.Uri.file(filePath),
//         filters: { Images: [extension] },
//       });
//     }
