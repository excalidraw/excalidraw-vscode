import * as vscode from "vscode";
import {writeFile} from "fs"
import {editDoc, getWebviewContent} from "./fs";

export class ExcalidrawEditorProvider
  implements vscode.CustomTextEditorProvider
{
  public static register(context: vscode.ExtensionContext) {
    const svgExportCommand = vscode.commands.registerCommand(
      "excalidraw.export.svg",
      () => {
        const excalidrawEditor = ExcalidrawEditorProvider.lastActiveEditor;
        if (typeof excalidrawEditor === "undefined" || !excalidrawEditor.active)
          vscode.window.showErrorMessage(
            "An Excalidraw editor must be focused to run this command!"
          );
        else ExcalidrawEditorProvider.lastActiveEditor?.exportImg("svg");
      }
    );

    const pngExportCommand = vscode.commands.registerCommand(
      "excalidraw.export.png",
      () => {
        const excalidrawEditor = ExcalidrawEditorProvider.lastActiveEditor;
        if (typeof excalidrawEditor === "undefined" || !excalidrawEditor.active)
          vscode.window.showErrorMessage(
            "An Excalidraw editor must be focused to run this command!"
          );
        else ExcalidrawEditorProvider.lastActiveEditor?.exportImg("png");
      }
    );

    const provider = new ExcalidrawEditorProvider(context);

    context.subscriptions.push(svgExportCommand);
    context.subscriptions.push(svgExportCommand);
    context.subscriptions.push(pngExportCommand);
    context.subscriptions.push(
      vscode.window.registerCustomEditorProvider("editor.excalidraw", provider)
    );
  }

  public static lastActiveEditor: ExcalidrawEditor | undefined;

  constructor(private readonly context: vscode.ExtensionContext) {}

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

    webviewPanel.webview.options = {
      enableScripts: true,
    };

    const postMessage = (message: any) => {
      console.log(`Extension -> Webview`, message);
      webviewPanel.webview.postMessage(message);
    }
    const editor = new ExcalidrawEditor(
      postMessage,
      document
    );
    ExcalidrawEditorProvider.lastActiveEditor = editor;

    webviewPanel.webview.onDidReceiveMessage((msg: { type: string }) => {
      console.log("Webview -> Extension", msg);
      const handler = editor.handlers[msg.type];
      handler(msg);
    });

    webviewPanel.webview.html = await getWebviewContent(
      vscode.Uri.joinPath(this.context.extensionUri, "media", "index.html"),
      webviewPanel.webview.asWebviewUri(document.uri),
      {
        theme: vscode.workspace.getConfiguration("excalidraw").get("theme") || "light"
      }
    );

    webviewPanel.onDidChangeViewState((e) => {
      if (document.uri.scheme === "git") return;
      if (e.webviewPanel.active) {
        udpateConfig()
        editor.active = true;
      } else {
        editor.active = false;
      }
    });

    // const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(
    //   async (e) => {
    //     // Not the right doc
    //     if (e === undefined) return;
    //     if (e.document.uri.toString() !== document.uri.toString()) return;
    //     // No change
    //     if (e.contentChanges.length == 0) return;
    //     // Change is coming from us
    //     if (this.isEditing) return;

    //     const raw = await vscode.workspace.fs.readFile(document.uri);
    //     const content = await new TextDecoder().decode(raw);

    //     webviewPanel.webview.postMessage({
    //       type: "update",
    //       payload: {
    //         json: content,
    //       },
    //     });
    //   }
    // );
    const udpateConfig = () => {
        const config = vscode.workspace.getConfiguration("excalidraw").get("config")
        if (config) postMessage({"type": "set-config", "config": "config"})
    }

    const changeConfigurationSubscription = vscode.workspace.onDidChangeConfiguration(
			(e) => {
				if (e.affectsConfiguration("excalidraw.theme")) {
          udpateConfig()
				}
			}
		);

    // Make sure we get rid of the listener when our editor is closed.
    webviewPanel.onDidDispose(() => {
      editor.active = false;
      // changeDocumentSubscription.dispose();
      changeConfigurationSubscription.dispose();
    });

    editor.active = true;
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

  handlers: Record<string, (msg: any) => void> = {
    // library: (msg: any) => {
    //   this.context.globalState.update("libraryItems", msg.payload.items);
    // },
    update: async (msg: any) => {
      const drawing: string = msg.json;
      await this.updateDocument(drawing);
    },
    "svg-export": async (msg: any) => {
      writeFile(msg.payload.path, msg.payload.svg, (err) => console.log(err));
    },
    "png-export": async (msg: any) => {
      var data = msg.payload.png.replace(/^data:image\/png;base64,/, "");
      var buf = Buffer.from(data, "base64");

      writeFile(msg.payload.path, buf, (err) => console.log(err));
    },
    log: (msg: any) => {
      console.log(msg.text);
    },
    error: (msg: any) => {
      console.error(msg.text)
      vscode.window.showErrorMessage(msg.text)
    },
    info: (msg: any) => {
      console.info(msg.text);
      vscode.window.showInformationMessage(msg.text)
    }
  };

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

  async importLibraryUrl(url: string, token: string) {
    this.postMessage({type: "import-library-url", url, token})
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
