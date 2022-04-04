import * as vscode from "vscode";
import { parse } from "path";
const {Base64} = require('js-base64');

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
          await this.context.globalState.update("libraryItems", msg.libraryItems);
          return
        case "change":
          await  this.updateTextDocument(document, msg.content).then(() => {
            if (this.config.get("autoSave")) document.save();
          });
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
    const htmlFile = vscode.Uri.joinPath(this.context.extensionUri, "public", "index.html")
    let uint8Array = await vscode.workspace.fs.readFile(htmlFile)
    let html =  Uint8ArrayToStr(uint8Array);

    const base64Config = Base64.encode(JSON.stringify(data));

    // Pass document uri to the webview
    html = html.replace(
      "{data-excalidraw}",
      base64Config
    );

    return html;
  }
}

// http://www.onicos.com/staff/iz/amuse/javascript/expert/utf.txt

/* utf.js - UTF-8 <=> UTF-16 convertion
 *
 * Copyright (C) 1999 Masanao Izumo <iz@onicos.co.jp>
 * Version: 1.0
 * LastModified: Dec 25 1999
 * This library is free.  You can redistribute it and/or modify it.
 */

function Uint8ArrayToStr(array: Uint8Array) {
  var out, i, len, c;
  var char2, char3;

  out = "";
  len = array.length;
  i = 0;
  while(i < len) {
  c = array[i++];
  switch(c >> 4)
  {
    case 0: case 1: case 2: case 3: case 4: case 5: case 6: case 7:
      // 0xxxxxxx
      out += String.fromCharCode(c);
      break;
    case 12: case 13:
      // 110x xxxx   10xx xxxx
      char2 = array[i++];
      out += String.fromCharCode(((c & 0x1F) << 6) | (char2 & 0x3F));
      break;
    case 14:
      // 1110 xxxx  10xx xxxx  10xx xxxx
      char2 = array[i++];
      char3 = array[i++];
      out += String.fromCharCode(((c & 0x0F) << 12) |
                     ((char2 & 0x3F) << 6) |
                     ((char3 & 0x3F) << 0));
      break;
  }
  }

  return out;
}
