import * as vscode from "vscode";
import { parse } from "path";
const { Base64 } = require('js-base64');

const excalidrawConfig = vscode.workspace.getConfiguration("excalidraw")

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
    webviewPanel.webview.options = {
      enableScripts: true,
    };

    const editor = new ExcalidrawEditor(document, webviewPanel, this.context);
    editor.start();
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

  // Allows to pass events between editors
  private static eventEmitter = new vscode.EventEmitter<{ type: string, msg: any }>();

  constructor(
    readonly document: vscode.TextDocument, readonly webviewPanel: vscode.WebviewPanel, readonly context: vscode.ExtensionContext) {
  }

  public async handleMessage(msg: any) {
    switch (msg.type) {
      case "ready":
        this.webviewPanel.webview.postMessage({ type: "library-change", library: await this.loadLibrary() });
        break;
      case "library-change":
        await this.saveLibrary(msg.library);
        ExcalidrawEditor.eventEmitter.fire(msg);
        return;
      case "change":
        await this.updateTextDocument(this.document, msg.content);
        return
      case "save":
        await this.document.save();
        return;
      case "error":
        vscode.window.showErrorMessage(msg.content);
        return;
      case "log":
        console.log(msg.content);
        return;
    }

  }

  getContentType() {
    const extension = parse(this.document.uri.path).ext;
    return {
      ".svg": "image/svg+xml",
      ".excalidraw": "application/json",
    }[extension]
  }

  isViewOnly() {
    return this.document.uri.scheme === "git" || this.document.uri.scheme === "conflictResolution";
  }

  public async start() {
    // Setup initial content for the webview
    // Receive message from the webview.
    const onDidReceiveMessage = this.webviewPanel.webview.onDidReceiveMessage((msg) => {
      this.handleMessage(msg);
    });

    const onDidReceiveEvent = ExcalidrawEditor.eventEmitter.event((msg) => {
      this.webviewPanel.webview.postMessage(msg);
    })

    this.webviewPanel.webview.html = await this.getHtmlForWebview(
      {
        content: this.document.getText(),
        contentType: this.getContentType(),
        library: await this.loadLibrary(),
        viewModeEnabled: this.isViewOnly() || undefined,
        theme: excalidrawConfig.get("theme", "auto"),
        name: parse(this.document.uri.fsPath).name,
      }
    );

    this.webviewPanel.onDidDispose(
      () => {
        onDidReceiveMessage.dispose()
        onDidReceiveEvent.dispose()
      }
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
    let libraryPath = await excalidrawConfig.get<string>("libraryPath");
    if (!libraryPath || !vscode.workspace.workspaceFolders) {
      return undefined;
    }


    const libraryUri = vscode.Uri.joinPath(vscode.workspace.workspaceFolders?.[0].uri, libraryPath);
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
