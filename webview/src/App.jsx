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

function useTheme(initialThemeConfig) {
  const [themeConfig, setThemeConfig] = useState(initialThemeConfig);
  const getExcalidrawTheme = () => {
    switch (themeConfig) {
      case "light":
        return THEME.LIGHT;
      case "dark":
        return THEME.DARK;
      case "auto":
        return detectTheme();
    }
  };
  const [theme, setTheme] = useState(getExcalidrawTheme(initialThemeConfig));
  const updateTheme = () => {
    setTheme(getExcalidrawTheme());
  };

  useEffect(updateTheme, [themeConfig]);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      updateTheme();
    });
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => {
      observer.disconnect();
    };
  }, []);

  return { theme, setThemeConfig };
}

export default function App(props) {
  const excalidrawRef = useRef(null);
  const sceneVersionRef = useRef(
    getSceneVersion(props.initialData.elements || [])
  );
  const libraryItemsRef = useRef(props.initialData.libraryItems || []);

  const { theme, setThemeConfig } = useTheme(props.theme);
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
          case "theme-change": {
            setThemeConfig(message.theme);
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

  async function onChange(elements, appState, files) {
    if (sceneVersionRef.current === getSceneVersion(elements)) {
      return;
    }
    sceneVersionRef.current = getSceneVersion(elements);
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
          ...props.initialData,
          scrollToContent: true,
        }}
        libraryReturnUrl={"vscode://pomdtr.excalidraw-editor/importLib"}
        onChange={debounce(onChange, 250)}
        onLinkOpen={(element, event) => {
          props.vscode.postMessage({
            type: "link-open",
            url: element.link,
          });
          event.preventDefault();
        }}
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
