import { loadFromBlob } from "@excalidraw/excalidraw";
import React from "react";
import ReactDOM from "react-dom";

import App from "./App";

const vscodeApi = (globalThis as { [key: string]: any }).acquireVsCodeApi();

async function getInitialData(rootDiv: HTMLElement) {
  const documentUri = rootDiv!.getAttribute("data-document-uri");
  const documentType = rootDiv!.getAttribute("data-document-type");

  const base64Config = rootDiv!.getAttribute("data-config")
  const bufferConfig = Buffer.from(base64Config!, 'base64')
  const config = JSON.parse(bufferConfig.toString('utf-8'));

  const content = await fetch(documentUri!).then((response) => response.text());
  const dataState = content !== ""
    ? await loadFromBlob(
        new Blob([content], { type: documentType! }),
        null,
        null
      )
    : { elements: [], appState: {} };
  return {
    initialData: {
      ...dataState,
      scrollToContent: true
    },
    documentType: documentType,
    config: config
  };
}

async function main() {
  const rootDiv = document.getElementById("root");

  const previousState = vscodeApi.getState();
  const excalidrawData: {initialData: any, documentType: any, config: any} = previousState
    ? previousState
    : await getInitialData(rootDiv!);
  const config = excalidrawData.config;

  ReactDOM.render(
    <React.StrictMode>
      <App
        api={vscodeApi}
        initialData={excalidrawData.initialData}
        documentType={excalidrawData.documentType}
        config={config}
      />
    </React.StrictMode>,
    rootDiv
  );
}

main().catch((e) => {
  vscodeApi.postMessage({ type: "error", text: e.toString() });
});
