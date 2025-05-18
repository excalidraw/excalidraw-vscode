import {
  hashElementsVersion,
  loadFromBlob,
  loadLibraryFromBlob,
} from "@excalidraw/excalidraw";
import React from "react";
import ReactDOM from "react-dom";
import { Base64 } from "js-base64";

import App from "./App";
import { sendChangesToVSCode, vscode } from "./vscode.ts";
import {
  AppState,
  BinaryFiles,
  ExcalidrawInitialDataState,
} from "@excalidraw/excalidraw/types";
import * as _ from "lodash-es";

const mimeTypeFallbacks = {
  "application/json": ["image/png", "image/svg+xml"],
  "image/svg+xml": ["application/json", "image/png"],
  "image/png": ["application/json", "image/svg+xml"],
};

async function getInitialData(
  content: Uint8Array,
  contentType: string
): Promise<[ExcalidrawInitialDataState, string]> {
  const potentialContentTypes = [
    contentType,
    ...mimeTypeFallbacks[contentType as keyof typeof mimeTypeFallbacks],
  ];
  for (const contentType of potentialContentTypes) {
    try {
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

      return [{ ...initialData }, contentType];
    } catch (_) {}
  }

  throw new Error("Unable to load initial data");
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

    const [initialData, initialContentType] =
      config.content.length > 0
        ? await getInitialData(
            new Uint8Array(config.content),
            config.contentType
          )
        : [undefined, config.contentType];

    const sendChanges = sendChangesToVSCode(config.contentType);
    const debouncedOnChange = (
      onChange: (
        elements: readonly any[],
        appState: Partial<AppState>,
        files: BinaryFiles
      ) => void,
      initialVersion: number
    ) => {
      let previousVersion = initialVersion;

      return _.debounce((elements, appState, files) => {
        const currentVersion = hashElementsVersion(elements);
        if (currentVersion !== previousVersion) {
          previousVersion = currentVersion;
          onChange(elements, appState, files);
        }
      }, 250);
    };

    const isDirty = !initialData || config.contentType != initialContentType;
    ReactDOM.render(
      <React.StrictMode>
        <App
          initialData={initialData}
          libraryItems={
            config.library ? await getLibraryItems(config.library) : []
          }
          name={config.name}
          viewModeEnabled={config.viewModeEnabled}
          theme={config.theme}
          onChange={debouncedOnChange(
            sendChanges,
            isDirty ? -1 : hashElementsVersion(initialData.elements || [])
          )}
          imageParams={config.imageParams}
          langCode={config.langCode}
          dirty={isDirty}
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
