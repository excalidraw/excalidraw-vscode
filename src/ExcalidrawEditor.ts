import * as vscode from "vscode";
import {parse} from "path";

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
    await editor.edit(document);
    ExcalidrawTextEditorProvider.activeEditor = editor;

    const onDidChangeViewState = webviewPanel.onDidChangeViewState((e) => {
      ExcalidrawTextEditorProvider.activeEditor = e.webviewPanel.active ? editor : undefined;
    })

    webviewPanel.onDidDispose(
      onDidChangeViewState.dispose
    )
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

  public async edit(document: vscode.TextDocument) {
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

    this.webviewPanel.webview.html = await this.getHtmlForWebview(
      {
        content: document.getText(),
        contentType: parse(document.uri.path).ext == '.excalidraw' ? "application/json" : "image/svg+xml",
        libraryItems: this.context.globalState.get("libraryItems") || [],
        viewModeEnabled: document.uri.scheme === "git" ? true : undefined,
        syncTheme: this.config.get("syncTheme", false),
        name: parse(document.uri.fsPath).name,
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

  private async getHtmlForWebview(
    data: Record<string, unknown>
  ): Promise<string> {
    const htmlFile = vscode.Uri.joinPath(this.context.extensionUri, "media/index.html")
    let html = await vscode.workspace.fs.readFile(htmlFile).then((data) => data.toString());

    // Fix resources path
    html = html.replace(
      /(<link.+?href="|<script.+?src="|<img.+?src="|url\(")(.+?)"/g,
      (m: string, $1: string, $2: string) => {
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
