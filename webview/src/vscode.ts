declare global {
  interface Window {
    acquireVsCodeApi(): any;
  }
}

export const vscode = window.acquireVsCodeApi();
