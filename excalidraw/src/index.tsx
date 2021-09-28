import { loadFromBlob } from "@excalidraw/excalidraw";
import { RestoredDataState } from "@excalidraw/excalidraw/types/data/restore";
import { AppState } from "@excalidraw/excalidraw/types/types";
import React from "react";
import ReactDOM from "react-dom";

import App from "./App";
import { VSCodeApi } from "./types";

const vscodeApi = (globalThis as {[key: string]: any}).acquireVsCodeApi() as VSCodeApi;

async function getInitialData(rootDiv: HTMLElement) {
  const documentUri = rootDiv!.getAttribute("data-document-uri");
  const documentType = rootDiv!.getAttribute("data-document-uri");
  const text = await fetch(documentUri!).then((response) => response.text());
  try {
    return loadFromBlob(new Blob([text], {type: documentType!}), null, null);
  } catch (error) {
    return { elements: [], appState: {} };
  }
}

async function main() {
  const rootDiv = document.getElementById("root");

  const previousState = vscodeApi.getState();
  const initialData = previousState
    ? (previousState as RestoredDataState)
    : await getInitialData(rootDiv!);
  ReactDOM.render(
    <React.StrictMode>
      <App
        api={vscodeApi}
        elements={initialData.elements}
        appState={initialData.appState as AppState}
      />
    </React.StrictMode>,
    rootDiv
  );
}

main().catch((e) => {
  vscodeApi.postMessage({ type: "log", text: e.toString() });
});
