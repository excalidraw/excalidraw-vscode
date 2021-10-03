import * as vscode from "vscode";
import { writeFile } from "fs";
import path = require("path");
import { TextDecoder } from "util";

export class ExcalidrawEditorProvider
  implements vscode.CustomTextEditorProvider
{
  public static register(context: vscode.ExtensionContext) {
    const svgExportCommand = vscode.commands.registerCommand(
      "excalidraw.exportSvg",
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
      "excalidraw.exportPng",
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
    };
    const editor = new ExcalidrawEditor(postMessage, document, this.context);
    ExcalidrawEditorProvider.lastActiveEditor = editor;

    webviewPanel.webview.onDidReceiveMessage((msg: { type: string }) => {
      console.log("Webview -> Extension", msg);
      const handler = editor.handlers[msg.type];
      handler(msg);
    });

    const webviewUri = webviewPanel.webview.asWebviewUri(document.uri);
    const extName = path.extname(webviewUri.fsPath);
    webviewPanel.webview.html = await getWebviewContent(
      vscode.Uri.joinPath(this.context.extensionUri, "media", "index.html"),
      {
        documentType: extName === ".svg" ? "image/svg+xml" : "application/json",
        viewModeEnabled: document.uri.scheme == "git",
        theme:
          vscode.workspace.getConfiguration("excalidraw").get("theme") ||
          "light",
        documentUri: webviewUri.toString(true),
        libraryItems: this.context.globalState.get("libraryItems", []),
      }
    );

    webviewPanel.onDidChangeViewState((e) => {
      if (document.uri.scheme === "git") return;
      if (e.webviewPanel.active) {
        udpateTheme();
        ExcalidrawEditorProvider.lastActiveEditor = editor
        editor.active = true;
      } else {
        editor.active = false;
      }
    });

    const udpateTheme = () => {
      const theme = vscode.workspace
        .getConfiguration("excalidraw")
        .get("theme");
      if (theme) postMessage({ type: "set-theme", theme });
    };

    const changeConfigurationSubscription =
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration("excalidraw.theme")) {
          udpateTheme();
        }
      });

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
  context: vscode.ExtensionContext;

  handlers: Record<string, (msg: any) => void> = {
    "library-update": (msg: any) => {
      this.context.globalState.update("libraryItems", msg.items);
    },
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
      console.error(msg.text);
      vscode.window.showErrorMessage(msg.text);
    },
    info: (msg: any) => {
      console.info(msg.text);
      vscode.window.showInformationMessage(msg.text);
    },
  };

  constructor(
    postMessage: (message: any) => void,
    document: vscode.TextDocument,
    context: vscode.ExtensionContext
  ) {
    this.postMessage = postMessage;
    this.document = document;
    this.context = context;
  }

  async updateDocument(text: string) {
    const edit = new vscode.WorkspaceEdit();
    edit.replace(
      this.document.uri,
      new vscode.Range(0, 0, this.document.lineCount, 0),
      text
    );
    const success = await vscode.workspace.applyEdit(edit);
    if (
      success &&
      vscode.workspace.getConfiguration("excalidraw").get("autoSave", true)
    )
      this.document.save();
  }

  async importLibraryUrl(url: string, token: string) {
    this.postMessage({ type: "import-library-url", url, token });
  }

  async exportImg(extension: string) {
    const uri = await getExportFilename(this.document, extension);
    if (!uri) return;

    const exportConfig = vscode.workspace.getConfiguration("excalidraw.export");
    this.postMessage({
      type: `export-to-${extension}`,
      path: uri.path,
      exportConfig: {
        exportBackground: exportConfig.get("exportBackground"),
        exportWithDarkMode: exportConfig.get("exportWithDarkMode"),
        exportEmbedScene: exportConfig.get("exportEmbedScene"),
      },
    });
  }
}

async function getWebviewContent(
  templateUri: vscode.Uri,
  excalidrawConfig: ExcalidrawConfig
): Promise<string> {
  const jsonConfig = JSON.stringify(excalidrawConfig);
  const bufferConfig = Buffer.from(jsonConfig, "utf-8");
  const base64Config = bufferConfig.toString("base64");

  let TemplateRaw = await vscode.workspace.fs.readFile(templateUri);
  return new TextDecoder()
    .decode(TemplateRaw)
    .replace("{{data-config}}", base64Config)
}

export function getExportFilename(
  document: vscode.TextDocument,
  extension: string
): Thenable<vscode.Uri | undefined> {
  const dirname = path.dirname(document.uri.fsPath);
  const basename = path.basename(
    document.uri.fsPath,
    path.extname(document.uri.fsPath)
  );

  const filePath = path.join(dirname, `${basename}.${extension}`);
  return vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.file(filePath),
    filters: { Images: [extension] },
  });
}
