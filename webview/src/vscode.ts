import {
  serializeAsJSON,
  exportToSvg,
  exportToBlob,
} from "@excalidraw/excalidraw-next";
import { ExcalidrawElement } from "@excalidraw/excalidraw-next/types/element/types";
import { AppState, BinaryFiles } from "@excalidraw/excalidraw-next/types/types";

declare global {
  interface Window {
    acquireVsCodeApi(): any;
  }
}

export const vscode = window.acquireVsCodeApi();

const textEncoder = new TextEncoder();

const svg2VSCode = async (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  files: BinaryFiles
) => {
  const svg = await exportToSvg({
    elements,
    appState: {
      ...appState,
      exportBackground: true,
      exportEmbedScene: true,
    },
    files,
  });
  vscode.postMessage({
    type: "change",
    content: Array.from(textEncoder.encode(svg.outerHTML)),
  });
};

const png2VSCode = async (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  files: BinaryFiles
) => {
  const blob = await exportToBlob({
    elements,
    appState: {
      ...appState,
      exportBackground: true,
      exportEmbedScene: true,
    },
    files,
  });
  if (!blob) {
    vscode.postMessage({
      type: "error",
      content: "Failed to export",
    });
    return;
  }
  const arrayBuffer = await blob.arrayBuffer();
  vscode.postMessage({
    type: "change",
    content: Array.from(new Uint8Array(arrayBuffer)),
  });
};

const json2VSCode = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  files: BinaryFiles
) => {
  vscode.postMessage({
    type: "change",
    content: Array.from(
      textEncoder.encode(serializeAsJSON(elements, appState, files, "local"))
    ),
  });
};

export const sendChangesToVSCode = (contentType: string) => {
  if (contentType === "image/svg+xml") {
    return svg2VSCode;
  }
  if (contentType === "image/png") {
    return png2VSCode;
  }
  if (contentType === "application/json") {
    return json2VSCode;
  }
  throw new Error(`Unsupported content type: ${contentType}`);
};
