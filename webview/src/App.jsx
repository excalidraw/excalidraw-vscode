import React, { useEffect, useState, useRef } from "react";
import {
  Excalidraw,
  exportToBlob,
  exportToSvg,
  getSceneVersion,
  loadFromBlob,
  loadLibraryFromBlob,
  serializeAsJSON,
  serializeLibraryAsJSON,
  THEME,
} from "@excalidraw/excalidraw-next";
import * as Mousetrap from "mousetrap";

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
    const observer = new MutationObserver((mutations) => {
      mutations.forEach(() => {
        if (themeVariant != "auto") {
          return;
        }
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
  const {
    elements = [],
    appState = {},
    scrollToContent,
    libraryItems = [],
    files = [],
  } = props.initialData;

  const excalidrawRef = useRef(null);
  const sceneVersion = useRef(getSceneVersion(elements));
  const libraryItemsRef = useRef(libraryItems);
  const theme = useTheme(props.theme);
  const textEncoder = new TextEncoder();

  useEffect(() => {
    const listener = async (e) => {
      try {
        const message = e.data;
        switch (message.type) {
          case "import-library": {
            excalidrawRef.current.importLibrary(
              message.libraryUrl,
              message.csrfToken
            );
            break;
          }
          case "update": {
            const content = new TextDecoder().decode(
              new Uint8Array(message.content)
            );
            const blob = new Blob([content], {
              type: "application/json",
            });
            const { elements, files } = await loadFromBlob(blob);
            await excalidrawRef.current.updateScene({
              elements,
              files,
              commitToHistory: true,
            });
            break;
          }
          case "library-change": {
            const blob = new Blob([message.library], {
              type: "application/json",
            });
            const libraryItems = await loadLibraryFromBlob(blob);
            if (
              JSON.stringify(libraryItems) ==
              JSON.stringify(libraryItemsRef.current)
            ) {
              return;
            }
            libraryItemsRef.current = libraryItems;
            excalidrawRef.current.updateScene({ libraryItems });
            break;
          }
        }
      } catch (e) {
        props.vscode.postMessage({ type: "error", content: e.message });
      }
    };
    window.addEventListener("message", listener);

    return () => {
      window.removeEventListener("message", listener);
    };
  }, []);

  // Saving trigger a dialog when using the extension in a browser
  useEffect(() => {
    const trap = Mousetrap.bind(["command+s", "ctrl+s"], () => {
      // return false to prevent default browser behavior // and stop event from bubbling
      props.vscode.postMessage({ type: "save" });
      return false;
    });
    return () => {
      trap.unbind();
    };
  });

  async function onChange(elements, appState, files) {
    if (sceneVersion.current === getSceneVersion(elements)) {
      return;
    }
    sceneVersion.current = getSceneVersion(elements);
    if (props.contentType == "application/json") {
      props.vscode.postMessage({
        type: "change",
        content: Array.from(
          textEncoder.encode(
            serializeAsJSON(elements, appState, files, "local")
          )
        ),
      });
    } else if (props.contentType == "image/svg+xml") {
      const svg = await exportToSvg({
        elements,
        appState: {
          ...appState,
          exportBackground: true,
          exportEmbedScene: true,
        },
        files,
      });
      props.vscode.postMessage({
        type: "change",
        content: Array.from(textEncoder.encode(svg.outerHTML)),
      });
    } else if (props.contentType == "image/png") {
      const blob = await exportToBlob({
        elements,
        appState: {
          ...appState,
          exportBackground: true,
          exportEmbedScene: true,
        },
        files,
      });
      const arrayBuffer = await blob.arrayBuffer();
      props.vscode.postMessage({
        type: "change",
        content: Array.from(new Uint8Array(arrayBuffer)),
      });
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
        name={props.name}
        theme={theme}
        viewModeEnabled={props.viewModeEnabled}
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
          if (
            JSON.stringify(libraryItems) ==
            JSON.stringify(libraryItemsRef.current)
          ) {
            return;
          }
          props.vscode.postMessage({
            type: "error",
            new: libraryItems,
          });
          libraryItemsRef.current = libraryItems;
          props.vscode.postMessage({
            type: "library-change",
            library: serializeLibraryAsJSON(libraryItems),
          });
        }}
      />
    </div>
  );
}

function debounce(func, wait) {
  let timeout;
  return function () {
    const context = this;
    const args = arguments;

    const later = function () {
      timeout = null;
      func.apply(context, args);
    };

    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
