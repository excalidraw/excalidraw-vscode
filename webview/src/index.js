import { loadFromBlob, loadLibraryFromBlob } from "@excalidraw/excalidraw-next";
import React from "react";
import ReactDOM from "react-dom";
import { Base64 } from "js-base64";

import App from "./App";
const vscode = window.acquireVsCodeApi();

async function getInitialData(content, contentType) {
  if (!content) {
    return {};
  }
  const initialData = await loadFromBlob(
    new Blob([content], { type: contentType }),
    null,
    null
  );

  return { ...initialData, scrollToContent: true };
}

function getExcalidrawConfig(rootElement) {
  const b64Config = rootElement.getAttribute("data-excalidraw");
  const strConfig = Base64.decode(b64Config);
  return JSON.parse(strConfig);
}

async function getLibraryItems(config) {
    try {
      const library = config.library
        ? await loadLibraryFromBlob(
            new Blob([config.library], { type: "application/json" })
          )
        : {};
      return library.version == 1 ? library.library : library.libraryItems;
    } catch (e) {
      vscode.postMessage({ type: "error", content: `Failed to load library: ${e}` });
      return [];
    }
}

async function main() {
  try {
    const rootElement = document.getElementById("root");

    const previousState = vscode.getState();
    const config = getExcalidrawConfig(rootElement);

    const initialData = previousState
      ? previousState
      : await getInitialData(config.content, config.contentType);

    let libraryItems = await getLibraryItems(config);

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
