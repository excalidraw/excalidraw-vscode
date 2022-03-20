import React, { useEffect, useRef } from "react";
import Excalidraw, {
  exportToSvg,
  getSceneVersion,
  serializeAsJSON,
} from "@excalidraw/excalidraw";

import "./styles.css";

export default function App(props) {
  const { initialData, vscode, contentType } = props;
  const {
    elements = [],
    appState = {},
    libraryItems = [],
    files = [],
  } = initialData;

  const excalidrawRef = useRef(null);
  const sceneVersion = useRef(getSceneVersion(elements));
  const libraryItemsRef = useRef(libraryItems);

  useEffect(() => {
    window.addEventListener("message", (e) => {
      const message = e.data;
      vscode.postMessage({ type: "log", msg: message });
      switch (message.type) {
        case "import-library":
          excalidrawRef.current.importLibrary(
            message.libraryUrl,
            message.csrfToken
          );
          break;
      }
    });

    return () => {
      window.removeEventListener("message");
    };
  }, []);

  function cleanAppState(appState) {
    const validKeys = [
      "scrollX",
      "scrollY",
      "zenModeEnabled",
      "theme",
      "viewModeEnabled",
      "gridModeEnable",
      "zoom",
      "selectedElementIds",
      "viewBackgroundColor",
    ];
    const filtered = Object.entries(appState).filter(([key, _]) =>
      validKeys.includes(key)
    );
    return Object.fromEntries(filtered);
  }

  async function onChangeWithDelay(elements, appState, files) {
    vscode.setState({
      elements,
      appState: cleanAppState(appState),
      libraryItems: libraryItemsRef.current,
      files,
    });

    if (sceneVersion.current != getSceneVersion(elements)) {
      sceneVersion.current = getSceneVersion(elements);
      if (contentType == "application/json") {
        vscode.postMessage({
          type: "change",
          content: serializeAsJSON(elements, appState, files, "local"),
        });
      } else {
        const svg = await exportToSvg({
          elements,
          appState: {
            ...appState,
            exportBackground: true,
            exportEmbedScene: true,
          },
          files,
        });
        vscode.postMessage({ type: "change", content: svg.outerHTML });
      }
    }
  }

  return (
    <div className="excalidraw-wrapper">
      <Excalidraw
        ref={excalidrawRef}
        UIOptions={{
          canvasActions: {
            loadScene: false,
            saveScene: false,
            saveToActiveFile: false,
          },
        }}
        initialData={{
          elements,
          appState: { ...appState },
          libraryItems,
          files,
        }}
        libraryReturnUrl={"vscode://pomdtr.excalidraw-editor/importLib"}
        onChange={debounce(onChangeWithDelay, 250)}
        onLibraryChange={(libraryItems) => {
          libraryItemsRef.current = libraryItems;
          vscode.postMessage({
            type: "library-change",
            libraryItems: libraryItems,
          });
        }}
      />
    </div>
  );
}

function debounce(func, wait) {
  var timeout;
  return function () {
    var context = this,
      args = arguments;

    var later = function () {
      timeout = null;
      func.apply(context, args);
    };

    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
