import * as vscode from "vscode";
import * as fs from "fs";
import { resolve } from "path";

export class ExcalidrawTextEditorProvider
  implements vscode.CustomTextEditorProvider {
  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new ExcalidrawTextEditorProvider(context);
    const providerRegistration = vscode.window.registerCustomEditorProvider(
      ExcalidrawTextEditorProvider.viewType,
      provider
    );
    return providerRegistration;
  }

  private static readonly viewType = "editor.excalidraw";

  static activeEditor: ExcalidrawEditor | undefined;


  constructor(private readonly context: vscode.ExtensionContext) { }

  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {

    const editor = new ExcalidrawEditor(webviewPanel, this.context);
    editor.edit(document);

    const onDidChangeViewState = webviewPanel.onDidChangeViewState((e) => {
      ExcalidrawTextEditorProvider.activeEditor = e.webviewPanel.active ? editor : undefined;
    })

    webviewPanel.onDidDispose(
      onDidChangeViewState.dispose
    )

    ExcalidrawTextEditorProvider.activeEditor = editor;
  }
}

class ExcalidrawEditor {
  private config: vscode.WorkspaceConfiguration;
  constructor(
    readonly webviewPanel: vscode.WebviewPanel, private readonly context: vscode.ExtensionContext) {

    webviewPanel.webview.options = {
      enableScripts: true,
    };

    this.config = vscode.workspace.getConfiguration("excalidraw");
  }

  public edit(document: vscode.TextDocument) {
    // Setup initial content for the webview
    // Receive message from the webview.
    const onDidReceiveMessage = this.webviewPanel.webview.onDidReceiveMessage((msg) => {
      switch (msg.type) {
        case "library-change":
          this.context.globalState.update("libraryItems", msg.libraryItems);
          break;
        case "change":
          this.updateTextDocument(document, msg.content).then(() => {
            if (this.config.get("autoSave")) document.save();
          });
          return;
        case "log":
          console.log(msg.msg);
          return;
      }
    });

    this.webviewPanel.webview.html = this.getHtmlForWebview(
      {
        content: document.getText(),
        contentType: document.fileName.endsWith(".svg") ? "image/svg+xml" : "application/json",
        libraryItems: this.context.globalState.get("libraryItems") || [],
      }
    );

    this.webviewPanel.onDidDispose(
      onDidReceiveMessage.dispose
    )

  }
  /**
* Apply Edit on Document
*/
  private updateTextDocument(
    document: vscode.TextDocument,
    content: string
  ): Thenable<boolean> {
    const edit = new vscode.WorkspaceEdit();

    edit.replace(
      document.uri,
      new vscode.Range(0, 0, document.lineCount, 0),
      content
    );

    return vscode.workspace.applyEdit(edit);
  }

  public importLibrary(libraryUrl: string, csrfToken: string) {
    this.webviewPanel.webview.postMessage({ type: "import-library", libraryUrl, csrfToken });
  }

  private getHtmlForWebview(
    data: Record<string, unknown>
  ): string {
    const htmlFile = vscode.Uri.file(resolve(this.context.extensionPath, "media", "index.html"));
    let html = fs.readFileSync(htmlFile.fsPath, "utf8");

    // Fix resources path
    html = html.replace(
      /(<link.+?href="|<script.+?src="|<img.+?src="|url\(")(.+?)"/g,
      (m, $1, $2) => {
        const resourcePath = `${this.context.extensionPath}/media${$2}`;
        return (
          $1 +
          vscode.Uri.from({ path: resourcePath, scheme: "vscode-resource" })
            .toString() +
          '"'
        );
      }
    );

    const base64Config = Buffer.from(JSON.stringify(data), "utf-8").toString("base64");

    // Pass document uri to the webview
    html = html.replace(
      "{data-excalidraw}",
      base64Config
    );

    return html;
  }
}
