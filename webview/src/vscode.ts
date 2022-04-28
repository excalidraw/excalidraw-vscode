import {
  serializeAsJSON,
  exportToSvg,
  exportToBlob,
} from "@excalidraw/excalidraw-next";
import { ExcalidrawElement } from "@excalidraw/excalidraw-next/types/element/types";
import { AppState, BinaryFiles } from "@excalidraw/excalidraw-next/types/types";
import _ from "lodash";

declare global {
  interface Window {
    acquireVsCodeApi(): any;
  }
}

export const vscode = window.acquireVsCodeApi();

const textEncoder = new TextEncoder();
const debounceDelay = 500;

const svg2VSCode = _.debounce(
  async (
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
  },
  debounceDelay
);

const png2VSCode = _.debounce(
  async (
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
  },
  debounceDelay
);

const json2VSCode = _.debounce(
  (
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
  },
  debounceDelay
);

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

  vscode.postMessage({
    type: "error",
    content: `Unsupported content type: ${contentType}`,
  });
};
