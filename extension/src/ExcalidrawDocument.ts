import * as vscode from "vscode";
import * as path from "path";

export class ExcalidrawDocument implements vscode.CustomDocument {
  uri: vscode.Uri;
  content: Uint8Array;
  protected _onDidDocumentChange = new vscode.EventEmitter<void>();
  public onDidDocumentChange = this._onDidDocumentChange.event;

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
  }

  async revert(cancellation: vscode.CancellationToken) {
    const content = await vscode.workspace.fs.readFile(this.uri);
    if (cancellation.isCancellationRequested) {
      return;
    }
    this.content = content;
  }

  async backup(
    destination: vscode.Uri,
    cancellation: vscode.CancellationToken
  ): Promise<vscode.CustomDocumentBackup> {
    await this.saveAs(destination, cancellation);
    return {
      id: destination.toString(),
      delete: async () => {
        try {
          await vscode.workspace.fs.delete(destination);
        } catch (e) {}
      },
    };
  }

  async save(cancellation?: vscode.CancellationToken) {
    this.saveAs(this.uri, cancellation);
  }

  async update(content: Uint8Array) {
    this.content = content;
    this._onDidDocumentChange.fire();
  }

  async saveAs(
    destination: vscode.Uri,
    cancellation?: vscode.CancellationToken
  ) {
    return vscode.workspace.fs.writeFile(destination, this.content);
  }

  private readonly _onDidDispose = new vscode.EventEmitter<void>();
  /**
   * Fired when the document is disposed of.
   */
  public readonly onDidDispose = this._onDidDispose.event;

  dispose(): void {
    this._onDidDispose.fire();
    this._onDidDocumentChange.dispose();
  }
}
