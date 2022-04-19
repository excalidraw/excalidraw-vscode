import * as vscode from "vscode";
import * as path from "path";

export class ExcalidrawDocument implements vscode.CustomDocument {
  uri: vscode.Uri;
  content: Uint8Array;
  private _onDidFileChange = new vscode.EventEmitter<Uint8Array>();
  public onDidFileChange = this._onDidFileChange.event;
  private _onDidContentChange = new vscode.EventEmitter<void>();
  public onDidContentChange = this._onDidContentChange.event;
  private fileSystemWatcher: vscode.FileSystemWatcher;

  public readonly contentType;

  getContentType(): string {
    switch (path.parse(this.uri.fsPath).ext) {
      case ".excalidraw":
        return "application/json";
      case ".svg":
        return "image/svg+xml";
      case ".png":
        return "image/png";
      default:
        throw new Error("Unknown file type");
    }
  }

  constructor(uri: vscode.Uri, content: Uint8Array) {
    this.uri = uri;
    this.content = content;
    this.contentType = this.getContentType();
    this.fileSystemWatcher = vscode.workspace.createFileSystemWatcher(
      uri.fsPath,
      true,
      false,
      true
    );
    this.fileSystemWatcher.onDidChange(async (uri) => {
      const content = await vscode.workspace.fs.readFile(uri);
      if (this.content.toString() === content.toString()) {
        return;
      }
      this.content = content;
      this._onDidFileChange.fire(content);
    });
  }

  async revert() {
    const content = await vscode.workspace.fs.readFile(this.uri);
    this.content = content;
  }

  async backup(destination: vscode.Uri): Promise<vscode.CustomDocumentBackup> {
    await this.saveAs(destination);
    return {
      id: destination.toString(),
      delete: async () => {
        try {
          await vscode.workspace.fs.delete(destination);
        } catch (e) {}
      },
    };
  }

  async save() {
    this.saveAs(this.uri);
  }

  async update(content: Uint8Array) {
    this.content = content;
    this._onDidContentChange.fire();
  }

  async saveAs(destination: vscode.Uri) {
    return vscode.workspace.fs.writeFile(destination, this.content);
  }

  private readonly _onDidDispose = new vscode.EventEmitter<void>();
  /**
   * Fired when the document is disposed of.
   */
  public readonly onDidDispose = this._onDidDispose.event;

  dispose(): void {
    this._onDidDispose.fire();
    this._onDidContentChange.dispose();
    this.fileSystemWatcher.dispose();
  }
}
