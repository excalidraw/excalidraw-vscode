import { loadFromBlob, loadLibraryFromBlob } from "@excalidraw/excalidraw-next";
import React from "react";
import ReactDOM from "react-dom";
import { Base64 } from "js-base64";

import App from "./App";

declare global {
  interface Window {
    acquireVsCodeApi(): any;
  }
}

const vscode = window.acquireVsCodeApi();

async function getInitialData(content: Uint8Array, contentType: string) {
  const initialData = await loadFromBlob(
    new Blob(
      [
        contentType == "image/png"
          ? content
          : new TextDecoder().decode(content),
      ],
      { type: contentType }
    ),
    null,
    null
  );

  return { ...initialData };
}

function getExcalidrawConfig(rootElement: HTMLElement) {
  const b64Config = rootElement.getAttribute("data-excalidraw-config");
  if (!b64Config) {
    throw Error("data-excalidraw-config attribute is missing");
  }
  const strConfig = Base64.decode(b64Config);
  return JSON.parse(strConfig);
}
async function getLibraryItems(libraryString: string) {
  try {
    return await loadLibraryFromBlob(
      new Blob([libraryString], { type: "application/json" })
    );
  } catch (e) {
    vscode.postMessage({
      type: "error",
      content: `Failed to load library: ${e}`,
    });
    return [];
  }
}

async function main() {
  try {
    const rootElement = document.getElementById("root");
    if (!rootElement) {
      throw Error("root element is missing");
    }
    const config = await getExcalidrawConfig(rootElement);

    const initialData =
      config.content.length > 0
        ? await getInitialData(
            new Uint8Array(config.content),
            config.contentType
          )
        : null;

    const libraryItems = config.library
      ? await getLibraryItems(config.library)
      : [];

    ReactDOM.render(
      <React.StrictMode>
        <App
          initialData={{ libraryItems, ...initialData }}
          vscode={vscode}
          name={config.name}
          contentType={config.contentType}
          viewModeEnabled={config.viewModeEnabled}
          theme={config.theme}
        />
      </React.StrictMode>,
      rootElement
    );
  } catch (error) {
    vscode.postMessage({
      type: "error",
      content: `Failed to load Document: ${error}`,
    });
  }
}

main();
