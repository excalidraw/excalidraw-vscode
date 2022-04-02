import React, { useEffect, useState, useRef } from "react";
import Excalidraw, {
  exportToSvg,
  getSceneVersion,
  serializeAsJSON,
  THEME,
} from "@excalidraw/excalidraw";

import *  as Mousetrap from "mousetrap";

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

// map multiple combinations to the same callback
Mousetrap.bind(['command+s', 'ctrl+s'], function() {
  // return false to prevent default browser behavior
  // and stop event from bubbling
  return false;
});


function useTheme(syncTheme) {
  const [theme, setTheme] = useState(syncTheme ? detectTheme() : undefined);

  useEffect(() => {
    if (!syncTheme) {
      return;
    }
    var observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (_) {
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
  const { initialData, vscode, contentType, syncTheme, viewModeEnabled, name } =
    props;
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
  const theme = useTheme(syncTheme);

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

  async function onChange(elements, appState, files) {
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
