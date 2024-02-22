import * as vscode from "vscode";
import * as path from "path";
import { Base64 } from "js-base64";

import { ExcalidrawDocument } from "./document";
import { languageMap } from "./lang";

const urlRegex = /^(http[s]?:\/\/)?(www\.)?[a-zA-Z0-9.-]+\.[a-zA-Z]{2,5}\.?/;
//^ Replace with URL.canParse once it becomes available in VSCode

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

  constructor(private readonly context: vscode.ExtensionContext) {}

  public async resolveCustomEditor(
    document: ExcalidrawDocument,
    webviewPanel: vscode.WebviewPanel
  ) {
    const editor = new ExcalidrawEditor(
      document,
      webviewPanel.webview,
      this.context
    );
    const editorDisposable = await editor.setupWebview();

    webviewPanel.onDidDispose(() => {
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

export class ExcalidrawEditor {
  // Allows to pass events between editors
  private static _onDidChangeLibrary = new vscode.EventEmitter<string>();
  private static onDidChangeLibrary =
    ExcalidrawEditor._onDidChangeLibrary.event;
  private static _onLibraryImport = new vscode.EventEmitter<{
    library: string;
  }>();
  private static onLibraryImport = ExcalidrawEditor._onLibraryImport.event;
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
    this.webview.options = {
      enableScripts: true,
    };

    let libraryUri = await this.getLibraryUri();

    const onDidReceiveMessage = this.webview.onDidReceiveMessage(
      async (msg) => {
        switch (msg.type) {
          case "library-change":
            const library = msg.library;
            await this.saveLibrary(library, libraryUri);
            ExcalidrawEditor._onDidChangeLibrary.fire(library);
            break;
          case "change":
            await this.document.update(new Uint8Array(msg.content));
            break;
          case "link-open":
            await this.handleLinkOpen(msg.url);
            break;
          case "error":
            vscode.window.showErrorMessage(msg.content);
            break;
          case "info":
            vscode.window.showInformationMessage(msg.content);
            break;
        }
      },
      this
    );

    const onDidChangeThemeConfiguration =
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (!e.affectsConfiguration("excalidraw.theme", this.document.uri)) {
          return;
        }
        this.webview.postMessage({
          type: "theme-change",
          theme: this.getTheme(),
        });
      }, this);

    vscode.workspace.onDidChangeConfiguration((e) => {
      if (!e.affectsConfiguration("excalidraw.language", this.document.uri)) {
        return;
      }
      this.webview.postMessage({
        type: "language-change",
        langCode: this.getLanguage(),
      });
    }, this);

    const onDidChangeEmbedConfiguration =
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (!e.affectsConfiguration("excalidraw.image", this.document.uri)) {
          return;
        }
        this.webview.postMessage({
          type: "image-params-change",
          imageParams: this.getImageParams(),
        });
      }, this);

    const onDidChangeLibraryConfiguration =
      vscode.workspace.onDidChangeConfiguration(async (e) => {
        if (
          !e.affectsConfiguration(
            "excalidraw.workspaceLibraryPath",
            this.document.uri
          )
        ) {
          return;
        }

        libraryUri = await this.getLibraryUri();
        const library = await this.loadLibrary(libraryUri);
        this.webview.postMessage({
          type: "library-change",
          library,
          merge: false,
        });
      });

    const onLibraryImport = ExcalidrawEditor.onLibraryImport(
      async ({ library }) => {
        this.webview.postMessage({
          type: "library-change",
          library,
          merge: true,
        });
      }
    );

    const onDidChangeLibrary = ExcalidrawEditor.onDidChangeLibrary(
      (library) => {
        this.webview.postMessage({
          type: "library-change",
          library,
          merge: false,
        });
      }
    );

    this.webview.html = await this.buildHtmlForWebview({
      content: Array.from(this.document.content),
      contentType: this.document.contentType,
      library: await this.loadLibrary(libraryUri),
      viewModeEnabled: this.isViewOnly() || undefined,
      theme: this.getTheme(),
      imageParams: this.getImageParams(),
      langCode: this.getLanguage(),
      name: this.extractName(this.document.uri),
    });

    return new vscode.Disposable(() => {
      onDidReceiveMessage.dispose();
      onDidChangeThemeConfiguration.dispose();
      onLibraryImport.dispose();
      onDidChangeLibraryConfiguration.dispose();
      onDidChangeLibrary.dispose();
      onDidChangeEmbedConfiguration.dispose();
    });
  }

  private getImageParams() {
    return vscode.workspace.getConfiguration("excalidraw").get("image");
  }

  private getLanguage() {
    return (
      vscode.workspace.getConfiguration("excalidraw").get("language") ||
      languageMap[vscode.env.language as keyof typeof languageMap]
    );
  }

  private getTheme() {
    return vscode.workspace
      .getConfiguration("excalidraw")
      .get("theme", "light");
  }

  public extractName(uri: vscode.Uri) {
    const name = path.parse(uri.fsPath).name;
    return name.endsWith(".excalidraw") ? name.slice(0, -11) : name;
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

  public static importLibrary(library: string) {
    this._onLibraryImport.fire({ library });
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

  private async handleLinkOpen(url: string) {
    if (url.match(urlRegex)) {
      await vscode.env.openExternal(vscode.Uri.parse(url));
      return;
    }
    const targetPath = path.resolve(
      path.dirname(this.document.uri.fsPath),
      url
    );
    const targetUri = vscode.Uri.file(targetPath);

    if (url.match(/\.excalidraw(\.|$)/)) {
      await vscode.commands.executeCommand(
        "vscode.openWith",
        targetUri,
        "editor.excalidraw"
      );
      return;
    }

    await vscode.window.showTextDocument(targetUri, {
      preview: true,
    });
  }

  private async buildHtmlForWebview(config: any): Promise<string> {
    const publicUri = vscode.Uri.joinPath(this.context.extensionUri, "public");
    const content = await vscode.workspace.fs.readFile(
      vscode.Uri.joinPath(publicUri, "index.html")
    );
    let html = this.textDecoder.decode(content);

    html = html.replace(
      "{{data-excalidraw-config}}",
      Base64.encode(JSON.stringify(config))
    );

    html = html.replace(
      "{{excalidraw-asset-path}}",
      `${this.webview.asWebviewUri(publicUri).toString()}/`
    );

    return this.fixLinks(html, publicUri);
  }
  private fixLinks(document: string, documentUri: vscode.Uri): string {
    return document.replace(
      new RegExp("((?:src|href)=['\"])(.*?)(['\"])", "gmi"),
      (subString: string, p1: string, p2: string, p3: string): string => {
        const lower = p2.toLowerCase();
        if (
          p2.startsWith("#") ||
          lower.startsWith("http://") ||
          lower.startsWith("https://")
        ) {
          return subString;
        }
        const newUri = vscode.Uri.joinPath(documentUri, p2);
        const newUrl = [p1, this.webview.asWebviewUri(newUri), p3].join("");
        return newUrl;
      }
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
