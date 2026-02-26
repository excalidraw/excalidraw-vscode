import * as vscode from "vscode";
import * as path from "path";

export class ExcalidrawDocument implements vscode.CustomDocument {
  uri: vscode.Uri;
  content: Uint8Array;

  private _onDidContentChange = new vscode.EventEmitter<void>();
  public onDidContentChange = this._onDidContentChange.event;

  private _onDidExternalChange = new vscode.EventEmitter<Uint8Array>();
  public onDidExternalChange = this._onDidExternalChange.event;

  private _isSaving = false;

  public readonly contentType;

  getContentType(): string {
    switch (path.parse(this.uri.fsPath).ext) {
      case ".svg":
        return "image/svg+xml";
      case ".png":
        return "image/png";
      default:
        return "application/json";
    }
  }

  constructor(uri: vscode.Uri, content: Uint8Array) {
    this.uri = uri;
    this.content = content;
    this.contentType = this.getContentType();
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
    this._isSaving = true;
    await this.saveAs(this.uri);
    // Delay clearing the flag to avoid racing with the file watcher
    setTimeout(() => { this._isSaving = false; }, 500);
  }

  async update(content: Uint8Array) {
    this._isSaving = true;
    this.content = content;
    this._onDidContentChange.fire();
    setTimeout(() => { this._isSaving = false; }, 500);
  }

  async handleExternalChange() {
    if (this._isSaving) {
      return;
    }
    const newContent = await vscode.workspace.fs.readFile(this.uri);
    if (Buffer.from(newContent).equals(Buffer.from(this.content))) {
      return;
    }
    this.content = newContent;
    this._onDidExternalChange.fire(newContent);
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
    this._onDidExternalChange.dispose();
  }
}
