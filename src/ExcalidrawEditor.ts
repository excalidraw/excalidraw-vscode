import * as vscode from "vscode";
import { TextDecoder } from "util";
import { editDoc, loadWebviewContent } from "./fs";

export class ExcalidrawEditorProvider
  implements vscode.CustomTextEditorProvider
{
  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    // vscode.commands.registerCommand("excalidraw.export.svg", () => {
    //   ExcalidrawEditorProvider.exportToIMG("svg");
    // });
    // vscode.commands.registerCommand("excalidraw.export.png", () => {
    //   ExcalidrawEditorProvider.exportToIMG("png");
    // });

    const provider = new ExcalidrawEditorProvider(context);
    const providerRegistration = vscode.window.registerCustomEditorProvider(
      ExcalidrawEditorProvider.viewType,
      provider
    );
    return providerRegistration;
  }

  private static readonly viewType = "editor.excalidraw";
  private isEditing: boolean;
  private lastFocusedEditor: ExcalidrawEditor | undefined;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.isEditing = false;
  }

  /**
   * Called when our custom editor is opened.
   *
   *
   */
  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    // Setup initial content for the webview

    // messageHost.registerHandler("svg-export", async (msg) => {
    // Receive message from the webview.

    webviewPanel.webview.options = {
      enableScripts: true,
    };
    const editor = new ExcalidrawEditor((message: any) => webviewPanel.webview.postMessage(message), document)

    const handlers: Record<string, (msg: any) => void> = {
      init: (_: any) => {
        vscode.commands.executeCommand(
          "setContext",
          "excalidraw.focused",
          true
        );
      },
      library: (msg: any) => {
        this.context.globalState.update("libraryItems", msg.payload.items);
      },
      update: async (msg: any) => {
        const drawing: string = msg.json;
        await editor.updateDocument(drawing)
      },
      "save-svg": async (msg: any) => {
        await vscode.workspace.fs.writeFile(msg.payload.path, msg.payload.svg);
      },
      "save-png": async (msg: any) => {
        var data = msg.payload.png.replace(/^data:image\/png;base64,/, "");
        var buf = Buffer.from(data, "base64");
        await vscode.workspace.fs.writeFile(msg.payload.path, buf);
      },
      log: (msg: any) => {
        console.log(msg.text);
      },
    };
    webviewPanel.webview.onDidReceiveMessage((msg: { type: string }) => {
      console.log("Webview -> Extension", msg);
      const handler = handlers[msg.type];
      handler(msg);
    });

    // let excalidrawConfig = vscode.workspace.getConfiguration("excalidraw");
    webviewPanel.webview.html = await loadWebviewContent(
      vscode.Uri.joinPath(this.context.extensionUri, "media", "index.html"),
      webviewPanel.webview.asWebviewUri(document.uri)
    );

    webviewPanel.onDidChangeViewState((e) => {
      if (document.uri.scheme === "git") return;
      if (e.webviewPanel.active) {
        // ExcalidrawEditorProvider.exportToIMG = exportToIMG;
        // refreshTheme();
      } else {
      }
    });

    const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(
      async (e) => {
        // Not the right doc
        if (e === undefined) return;
        if (e.document.uri.toString() !== document.uri.toString()) return;
        // No change
        if (e.contentChanges.length == 0) return;
        // Change is coming from us
        if (this.isEditing) return;

        const raw = await vscode.workspace.fs.readFile(document.uri);
        const content = await new TextDecoder().decode(raw);

        webviewPanel.webview.postMessage({
          type: "update",
          payload: {
            json: content,
          },
        });
      }
    );

    // Make sure we get rid of the listener when our editor is closed.
    webviewPanel.onDidDispose(() => {
      changeDocumentSubscription.dispose();
      // changeConfigurationSubscription.dispose();
    });
  }

  async showExportNotification(uri: vscode.Uri) {
    const choice = await vscode.window.showInformationMessage(
      `Export Successful`,
      "Open"
    );
    if (choice === "Open")
      return vscode.commands.executeCommand("vscode.open", uri);
  }
}

class ExcalidrawEditor {
  postMessage: (message: any) => void;
  document: vscode.TextDocument;
  public active: boolean = false;

  constructor(
    postMessage: (message: any) => void,
    document: vscode.TextDocument
  ) {
    this.postMessage = postMessage;
    this.document = document;
  }

  async updateDocument(text: string) {
    const success = await editDoc(this.document, text);
    console.log(success);
    // if (success && excalidrawConfig.get("autoSave", true)) document.save();
  }

  async exportImg(extension: string) {
    const uri = await vscode.window.showSaveDialog({
      filters: { Images: [extension] },
    });
    const exportConfig = vscode.workspace.getConfiguration("excalidraw.export");
    if (uri !== undefined)
      this.postMessage({
        type: `export-to-${extension}`,
        path: uri.path,
        exportConfig: {
          exportBackground: exportConfig.get("exportBackground"),
          shouldAddWatermark: exportConfig.get("shouldAddWatermark"),
          exportWithDarkMode: exportConfig.get("exportWithDarkMode"),
          exportEmbedScene: exportConfig.get("exportEmbedScene"),
        },
      });
  }
}
