import * as vscode from "vscode";
import * as path from "path";
import { Base64 } from "js-base64";

import { ExcalidrawDocument } from "./ExcalidrawDocument";

const excalidrawConfig = vscode.workspace.getConfiguration("excalidraw");

export class ExcalidrawEditorProvider
  implements vscode.CustomEditorProvider<ExcalidrawDocument>
{
  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new ExcalidrawEditorProvider(context);
    const providerRegistration = vscode.window.registerCustomEditorProvider(
      ExcalidrawEditorProvider.viewType,
      provider,
      {
        supportsMultipleEditorsPerDocument: false,
        webviewOptions: { retainContextWhenHidden: true },
      }
    );
    context.globalState.setKeysForSync(["library"]);

    return providerRegistration;
  }

  private static readonly viewType = "editor.excalidraw";

  static activeEditor: ExcalidrawEditor | undefined;

  constructor(private readonly context: vscode.ExtensionContext) {}

  public async resolveCustomEditor(
    document: ExcalidrawDocument,
    webviewPanel: vscode.WebviewPanel
  ) {
    webviewPanel.webview.options = {
      enableScripts: true,
    };

    const editor = new ExcalidrawEditor(document, webviewPanel, this.context);
    const editorDisposable = await editor.start();
    ExcalidrawEditorProvider.activeEditor = editor;

    const onDidChangeViewState = webviewPanel.onDidChangeViewState((e) => {
      ExcalidrawEditorProvider.activeEditor = e.webviewPanel.active
        ? editor
        : undefined;
    });

    webviewPanel.onDidDispose(() => {
      onDidChangeViewState.dispose();
      editorDisposable.dispose();
    });
  }

  private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<
    vscode.CustomDocumentContentChangeEvent<ExcalidrawDocument>
  >();
  public readonly onDidChangeCustomDocument =
    this._onDidChangeCustomDocument.event;

  async backupCustomDocument(
    document: ExcalidrawDocument,
    context: vscode.CustomDocumentBackupContext
  ): Promise<vscode.CustomDocumentBackup> {
    return document.backup(context.destination);
  }

  // TODO: Backup Support
  async openCustomDocument(
    uri: vscode.Uri,
    openContext: vscode.CustomDocumentOpenContext
  ): Promise<ExcalidrawDocument> {
    const content = await vscode.workspace.fs.readFile(
      openContext.backupId ? vscode.Uri.parse(openContext.backupId) : uri
    );
    const document = new ExcalidrawDocument(uri, content);

    const onDidDocumentChange = document.onDidDocumentChange(() => {
      this._onDidChangeCustomDocument.fire({ document });
    });

    document.onDidDispose(() => {
      onDidDocumentChange.dispose();
    });

    return document;
  }

  revertCustomDocument(document: ExcalidrawDocument): Thenable<void> {
    return document.revert();
  }

  saveCustomDocument(document: ExcalidrawDocument): Thenable<void> {
    return document.save();
  }

  async saveCustomDocumentAs(
    document: ExcalidrawDocument,
    destination: vscode.Uri
  ) {
    await document.saveAs(destination);
  }
}

class ExcalidrawEditor {
  // Allows to pass events between editors
  private static eventEmitter = new vscode.EventEmitter<{
    type: string;
    msg: any;
  }>();

  private textDecoder = new TextDecoder();

  constructor(
    readonly document: ExcalidrawDocument,
    readonly webviewPanel: vscode.WebviewPanel,
    readonly context: vscode.ExtensionContext
  ) {}

  public async handleMessage(msg: any) {
    switch (msg.type) {
      case "library-change":
        await this.saveLibrary(msg.library);
        ExcalidrawEditor.eventEmitter.fire(msg);
        return;
      case "change":
        await this.document.update(new Uint8Array(msg.content));
        return;
      case "save":
        await this.document.save();
        return;
      case "error":
        vscode.window.showErrorMessage(msg.content);
        return;
      case "info":
        vscode.window.showInformationMessage(msg.content);
    }
  }

  isViewOnly() {
    return (
      this.document.uri.scheme === "git" ||
      this.document.uri.scheme === "conflictResolution"
    );
  }

  public async start() {
    // Setup initial content for the webview
    // Receive message from the webview.
    const onDidReceiveMessage = this.webviewPanel.webview.onDidReceiveMessage(
      (msg) => {
        this.handleMessage(msg);
      }
    );

    const onDidReceiveEvent = ExcalidrawEditor.eventEmitter.event((msg) => {
      this.webviewPanel.webview.postMessage(msg);
    });

    this.webviewPanel.webview.html = await this.buildHtmlForWebview({
      content: Array.from(this.document.content),
      contentType: this.document.contentType,
      library: await this.loadLibrary(),
      viewModeEnabled: this.isViewOnly() || undefined,
      theme: excalidrawConfig.get("theme", "auto"),
      name: path.parse(this.document.uri.fsPath).name,
    });

    return new vscode.Disposable(() => {
      onDidReceiveMessage.dispose();
      onDidReceiveEvent.dispose();
    });
  }

  public importLibrary(libraryUrl: string, csrfToken: string) {
    this.webviewPanel.webview.postMessage({
      type: "import-library",
      libraryUrl,
      csrfToken,
    });
  }

  public async getLibraryUri() {
    const libraryPath = await excalidrawConfig.get<string>("libraryPath");
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!libraryPath || !workspaceFolders) {
      return;
    }

    const fileWorkspace = getFileWorkspaceFolder(
      this.document.uri,
      workspaceFolders as vscode.WorkspaceFolder[]
    );
    if (!fileWorkspace) {
      return;
    }

    return vscode.Uri.joinPath(fileWorkspace.uri, libraryPath);
  }

  public async loadLibrary() {
    const libraryUri = await this.getLibraryUri();
    if (!libraryUri) {
      return this.context.globalState.get<string>("library");
    }
    try {
      const libraryContent = await vscode.workspace.fs.readFile(libraryUri);
      return this.textDecoder.decode(libraryContent);
    } catch (e) {
      return this.context.globalState.get<string>("library");
    }
  }

  public async saveLibrary(library: string) {
    const libraryUri = await this.getLibraryUri();
    if (!libraryUri) {
      return this.context.globalState.update("library", library);
    }
    await vscode.workspace.fs.writeFile(
      libraryUri,
      new TextEncoder().encode(library)
    );
  }

  private async buildHtmlForWebview(config: any): Promise<string> {
    const htmlUri = vscode.Uri.joinPath(
      this.context.extensionUri,
      "public",
      "index.html"
    );
    const content = await vscode.workspace.fs.readFile(htmlUri);
    const html = this.textDecoder.decode(content);

    return html.replace(
      "{{data-excalidraw-config}}",
      Base64.encode(JSON.stringify(config))
    );
  }
}

function getFileWorkspaceFolder(
  uri: vscode.Uri,
  workspaceFolders: vscode.WorkspaceFolder[]
): vscode.WorkspaceFolder | undefined {
  const parts = uri.path.split(path.sep).slice(0, -1);
  while (parts.length > 0) {
    const joined = parts.join(path.sep);
    const folder = workspaceFolders.find((f) => f.uri.path === joined);
    if (folder) {
      return folder;
    }
    parts.pop();
  }
}
