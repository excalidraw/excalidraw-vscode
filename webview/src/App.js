import React, { useEffect, useState, useRef } from "react";
import Excalidraw, {
  exportToSvg,
  getSceneVersion,
  loadLibraryFromBlob,
  loadFromBlob,
  serializeAsJSON,
  serializeLibraryAsJSON,
  THEME,
} from "@excalidraw/excalidraw-next";

import "./styles.css";

function detectTheme() {
  switch (document.body.className) {
    case "vscode-dark":
      return THEME.DARK;
    case "vscode-light":
      return THEME.LIGHT;
    default:
      return THEME.LIGHT;
  }
}

function useTheme(themeVariant) {
  const [theme, setTheme] = useState(
    themeVariant == "auto" ? detectTheme() : themeVariant
  );

  useEffect(() => {
    var observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (_) {
        if (themeVariant != "auto") return;
        setTheme(detectTheme());
      });
    });
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  return theme;
}

export default function App(props) {
  const { initialData, vscode, contentType, viewModeEnabled, name } = props;
  const {
    elements = [],
    appState = {},
    scrollToContent,
    libraryItems = [],
    files = [],
  } = initialData;

  const excalidrawRef = useRef(null);
  const sceneVersion = useRef(getSceneVersion(elements));
  const libraryItemsRef = useRef(libraryItems);
  const theme = useTheme(props.theme);

  const hasLibraryChanged = (libraryItems) =>
    JSON.stringify(libraryItems) != JSON.stringify(libraryItemsRef.current);

  const hasContentChanged = (elements) =>
    getSceneVersion(elements) != sceneVersion.current;

  useEffect(() => {
    window.addEventListener("message", async (e) => {
      try {
        const message = e.data;
        vscode.postMessage({
          type: "log",
          content: `Extension -> Webview ${message.type}`,
        });
        switch (message.type) {
          case "import-library":
            excalidrawRef.current.importLibrary(
              message.libraryUrl,
              message.csrfToken
            );
            break;
          case "library-change": {
            const blob = new Blob([message.library], {
              type: "application/json",
            });
            const { libraryItems } = await loadLibraryFromBlob(blob);
            if (!hasLibraryChanged(libraryItems)) return;

            libraryItemsRef.current = libraryItems;
            excalidrawRef.current.updateScene({ libraryItems });
            break;
          }
          case "change": {
            const blob = new Blob([message.content], {
              type: message.contentType,
            });

            const { elements, appState, files } = await loadFromBlob(blob);
            if (!hasContentChanged(elements, appState)) return;
            sceneVersion.current = getSceneVersion(elements);

            excalidrawRef.current.updateScene({
              elements,
              files,
            });
            break;
          }
        }
      } catch (error) {
        vscode.postMessage({ type: "error", content: error.message });
      }
    });

    vscode.postMessage({ type: "ready" });

    return () => {
      window.removeEventListener("message");
    };
  }, []);

  async function onChange(elements, appState, files) {
    vscode.setState({
      elements,
      appState: cleanAppState(appState),
      libraryItems: libraryItemsRef.current,
      files,
    });

    if (hasContentChanged(elements)) {
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
        name={name}
        theme={theme}
        viewModeEnabled={viewModeEnabled}
        initialData={{
          elements,
          scrollToContent,
          appState: { ...appState },
          libraryItems,
          files,
        }}
        libraryReturnUrl={"vscode://pomdtr.excalidraw-editor/importLib"}
        onChange={debounce(onChange, 250)}
        onLibraryChange={(libraryItems) => {
          if (hasLibraryChanged(libraryItems)) {
            libraryItemsRef.current = libraryItems;
            vscode.postMessage({
              type: "library-change",
              library: serializeLibraryAsJSON(libraryItems),
            });
          }
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

function cleanAppState(appState) {
  const validKeys = [
    "scrollX",
    "scrollY",
    "zenModeEnabled",
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
