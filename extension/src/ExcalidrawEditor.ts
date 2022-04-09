import * as vscode from "vscode";
import { parse } from "path";
const { Base64 } = require('js-base64');

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
    const onDidReceiveMessage = this.webviewPanel.webview.onDidReceiveMessage(async (msg) => {
      switch (msg.type) {
        case "library-change":
          await this.saveLibrary(msg.library);
          return
        case "change":
          await this.updateTextDocument(document, msg.content);
          return
        case "save":
          await document.save();
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
        library: await this.loadLibrary(),
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

  public async getLibraryUri() {
    let libraryPath = await this.config.get<string>("libraryPath");
    if (!libraryPath) {
      return undefined;
    }

    libraryPath = libraryPath?.replace("${workspaceFolder}", vscode.workspace.workspaceFolders?.[0].uri.fsPath || "undefined");

    const libraryUri = vscode.Uri.file(libraryPath)
    try {
      await vscode.workspace.fs.stat(libraryUri)
      return libraryUri;
    } catch (e) {
      vscode.window.showErrorMessage(`Library file not found at ${libraryUri.fsPath}`);
    }
  }

  public async loadLibrary() {
    const libraryUri = await this.getLibraryUri();
    if (!libraryUri) {
      return this.context.globalState.get<string>("library");
    }
    const libraryDocument = await vscode.workspace.openTextDocument(libraryUri);
    return libraryDocument.getText();
  }

  public async saveLibrary(library: string) {
    const libraryUri = await this.getLibraryUri();
    if (!libraryUri) {
      return this.context.globalState.update("library", library);
    }
    const libraryDocument = await vscode.workspace.openTextDocument(libraryUri);
    await this.updateTextDocument(libraryDocument, library);
  }

  private async getHtmlForWebview(
    data: Record<string, unknown>
  ): Promise<string> {
    const htmlFile = vscode.Uri.joinPath(this.context.extensionUri, "public", "index.html")
    let document = await vscode.workspace.openTextDocument(htmlFile);
    let html = document.getText();

    const base64Config = Base64.encode(JSON.stringify(data));

    // Pass document uri to the webview
    html = html.replace(
      "{data-excalidraw}",
      base64Config
    );

    return html;
  }
}
