import {
  serializeAsJSON,
  exportToSvg,
  exportToBlob,
} from "@excalidraw/excalidraw";
import { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";

// @ts-ignore
export const vscode = acquireVsCodeApi();

const textEncoder = new TextEncoder();

const svg2VSCode = async (
  elements: readonly any[],
  appState: Partial<AppState>,
  files: BinaryFiles
) => {
  const nonDeletedElements = elements.filter((element: any) => !element.isDeleted);
  const svg = await exportToSvg({
    elements: nonDeletedElements,
    appState,
    files,
  });
  vscode.postMessage({
    type: "change",
    content: Array.from(textEncoder.encode(svg.outerHTML)),
  });
};

const png2VSCode = async (
  elements: readonly any[],
  appState: Partial<AppState>,
  files: BinaryFiles
) => {
  const nonDeletedElements = elements.filter((element: any) => !element.isDeleted);
  const blob = await exportToBlob({
    elements: nonDeletedElements,
    appState,
    files,
    getDimensions(width: number, height: number) {
      const scale = appState.exportScale || 2;
      return {
        width: width * scale,
        height: height * scale,
        scale,
      };
    },
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
  elements: readonly any[],
  appState: Partial<AppState>,
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
