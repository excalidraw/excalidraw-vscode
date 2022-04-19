import * as vscode from "vscode";
import * as path from "path";
import { Base64 } from "js-base64";

import { ExcalidrawDocument } from "./ExcalidrawDocument";

export class ExcalidrawEditorProvider
  implements vscode.CustomEditorProvider<ExcalidrawDocument>
{
  public static async register(
    context: vscode.ExtensionContext
  ): Promise<vscode.Disposable> {
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

    ExcalidrawEditorProvider.migrateLegacyLibraryItems(context);

    return providerRegistration;
  }

  private static migrateLegacyLibraryItems(context: vscode.ExtensionContext) {
    const libraryItems = context.globalState.get("libraryItems");
    if (!libraryItems) {
      return;
    }
    context.globalState
      .update(
        "library",
        JSON.stringify({
          type: "excalidrawlib",
          version: 2,
          source:
            "https://marketplace.visualstudio.com/items?itemName=pomdtr.excalidraw-editor",
          libraryItems,
        })
      )
      .then(() => {
        context.globalState.update("libraryItems", undefined);
      });
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

    const editor = new ExcalidrawEditor(
      document,
      webviewPanel.webview,
      this.context
    );
    const editorDisposable = await editor.setupWebview();
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

    const onDidDocumentChange = document.onDidContentChange(() => {
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
  private static onLibraryChange = new vscode.EventEmitter<{
    uri?: vscode.Uri;
    content: any;
  }>();

  private textDecoder = new TextDecoder();

  constructor(
    readonly document: ExcalidrawDocument,
    readonly webview: vscode.Webview,
    readonly context: vscode.ExtensionContext
  ) {}

  isViewOnly() {
    return (
      this.document.uri.scheme === "git" ||
      this.document.uri.scheme === "conflictResolution"
    );
  }

  public async setupWebview() {
    // Setup initial content for the webview
    // Receive message from the webview.

    const libraryUri = await this.getLibraryUri();

    const onDidReceiveMessage = this.webview.onDidReceiveMessage(
      async (msg) => {
        switch (msg.type) {
          case "library-change":
            await this.saveLibrary(msg.library, libraryUri);
            ExcalidrawEditor.onLibraryChange.fire({
              uri: libraryUri,
              content: msg.library,
            });
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
      },
      this
    );

    const onLibraryChange = ExcalidrawEditor.onLibraryChange.event((msg) => {
      if (msg.uri?.toString() === libraryUri?.toString()) {
        this.webview.postMessage({
          type: "library-change",
          library: msg.content,
        });
      }
    });

    const onDidFileChange = this.document.onDidFileChange((content) => {
      this.webview.postMessage({
        type: "update",
        content: Array.from(content),
      });
    });

    this.webview.html = await this.buildHtmlForWebview({
      content: Array.from(this.document.content),
      contentType: this.document.contentType,
      library: await this.loadLibrary(libraryUri),
      viewModeEnabled: this.isViewOnly() || undefined,
      theme: vscode.workspace
        .getConfiguration("excalidraw")
        .get("theme", "auto"),
      name: this.extractName(this.document.uri),
    });

    return new vscode.Disposable(() => {
      onDidReceiveMessage.dispose();
      onDidFileChange.dispose();
      onLibraryChange.dispose();
    });
  }

  public extractName(uri: vscode.Uri) {
    const name = path.parse(uri.fsPath).name;
    return name.endsWith(".excalidraw") ? name.slice(0, -11) : name;
  }

  public importLibrary(libraryUrl: string, csrfToken: string) {
    this.webview.postMessage({
      type: "import-library",
      libraryUrl,
      csrfToken,
    });
  }

  public async getLibraryUri() {
    const libraryPath = await vscode.workspace
      .getConfiguration("excalidraw")
      .get<string>("workspaceLibraryPath");
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

  public async loadLibrary(libraryUri?: vscode.Uri) {
    if (!libraryUri) {
      return this.context.globalState.get<string>("library");
    }
    try {
      const libraryContent = await vscode.workspace.fs.readFile(libraryUri);
      return this.textDecoder.decode(libraryContent);
    } catch (e) {
      vscode.window.showErrorMessage(`Failed to load library: ${e}`);
      return this.context.globalState.get<string>("library");
    }
  }

  public async saveLibrary(library: string, libraryUri?: vscode.Uri) {
    if (!libraryUri) {
      return this.context.globalState.update("library", library);
    }
    try {
      await vscode.workspace.fs.writeFile(
        libraryUri,
        new TextEncoder().encode(library)
      );
    } catch (e) {
      await vscode.window.showErrorMessage(`Failed to save library: ${e}`);
    }
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
