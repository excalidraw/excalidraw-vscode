import { loadFromBlob } from "@excalidraw/excalidraw";
import React from "react";
import ReactDOM from "react-dom";

import {VscodeAPI, App, ExcalidrawState} from "./App";



const vscodeApi: VscodeAPI = (globalThis as { [key: string]: any }).acquireVsCodeApi();
async function getInitialData(rootDiv: HTMLElement): Promise<ExcalidrawState> {
  const base64Config = rootDiv!.getAttribute("data-config")
  const bufferConfig = Buffer.from(base64Config!, 'base64')
  const config: ExcalidrawConfig = JSON.parse(bufferConfig.toString('utf-8'));

  const content = await fetch(config.documentUri!).then((response) => response.text());
  const dataState = content !== ""
    ? await loadFromBlob(
        new Blob([content], { type: config.documentType! }),
        null,
        null
      )
    : { elements: [], appState: {} };
  return {
    initialData: {
      elements: dataState.elements,
      appState: dataState.appState,
      scrollToContent: true,
      libraryItems: config.libraryItems
    },
    viewModeEnabled: config.viewModeEnabled,
    documentType: config.documentType,
    theme: config.theme
  };
}

async function main() {
  const rootDiv = document.getElementById("root");

  const previousState = vscodeApi.getState();
  const excalidrawData: ExcalidrawState = previousState
    ? previousState
    : await getInitialData(rootDiv!);

  ReactDOM.render(
    <React.StrictMode>
      <App
        api={vscodeApi}
        initialData={excalidrawData.initialData}
        documentType={excalidrawData.documentType}
        viewModeEnabled={excalidrawData.viewModeEnabled}
        theme={excalidrawData.theme}
      />
    </React.StrictMode>,
    rootDiv
  );
}

main().catch((e) => {
  vscodeApi.postMessage({ type: "error", text: e.toString() });
});
