import React, { useEffect, useState, useRef } from "react";
import {
  Excalidraw,
  exportToBlob,
  exportToSvg,
  getSceneVersion,
  loadLibraryFromBlob,
  serializeAsJSON,
  serializeLibraryAsJSON,
  THEME,
} from "@excalidraw/excalidraw-next";

import "./styles.css";
import {
  ExcalidrawImperativeAPI,
  AppState,
  BinaryFiles,
} from "@excalidraw/excalidraw-next/types/types";
import { ExcalidrawElement } from "@excalidraw/excalidraw-next/types/element/types";

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

function useTheme(initialThemeConfig: string) {
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
  const [theme, setTheme] = useState(getExcalidrawTheme());
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

export default function App(props: {
  initialData: any;
  vscode: any;
  name: string;
  contentType: string;
  theme: string;
  viewModeEnabled: boolean;
}) {
  const excalidrawRef = useRef<ExcalidrawImperativeAPI>(null);
  const sceneVersionRef = useRef(
    getSceneVersion(props.initialData.elements || [])
  );
  const libraryItemsRef = useRef(props.initialData.libraryItems || []);
  const { theme, setThemeConfig } = useTheme(props.theme);
  const textEncoder = new TextEncoder();

  useEffect(() => {
    const listener = async (e: any) => {
      try {
        const message = e.data;
        switch (message.type) {
          case "import-library": {
            excalidrawRef.current!.importLibrary(
              message.libraryUrl,
              message.csrfToken
            );
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
            excalidrawRef.current!.updateScene({ libraryItems });
            break;
          }
          case "theme-change": {
            setThemeConfig(message.theme);
            break;
          }
        }
      } catch (e) {
        props.vscode.postMessage({
          type: "error",
          content: (e as Error).message,
        });
      }
    };
    window.addEventListener("message", listener);

    return () => {
      window.removeEventListener("message", listener);
    };
  }, []);

  async function onChange(
    elements: readonly ExcalidrawElement[],
    appState: AppState,
    files: BinaryFiles
  ) {
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
      if (!blob) {
        props.vscode.postMessage({
          type: "error",
          content: "Failed to export",
        });
        return;
      }
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

export const debounce = <T extends any[]>(
  fn: (...args: T) => void,
  timeout: number
) => {
  let handle = 0;
  let lastArgs: T | null = null;
  const ret = (...args: T) => {
    lastArgs = args;
    clearTimeout(handle);
    handle = window.setTimeout(() => {
      lastArgs = null;
      fn(...args);
    }, timeout);
  };
  ret.flush = () => {
    clearTimeout(handle);
    if (lastArgs) {
      const _lastArgs = lastArgs;
      lastArgs = null;
      fn(..._lastArgs);
    }
  };
  ret.cancel = () => {
    lastArgs = null;
    clearTimeout(handle);
  };
  return ret;
};
