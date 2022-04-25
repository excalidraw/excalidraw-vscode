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
import * as _ from "lodash-es";

import "./styles.css";
import {
  ExcalidrawImperativeAPI,
  AppState,
  BinaryFiles,
  LibraryItems,
  ExcalidrawInitialDataState,
} from "@excalidraw/excalidraw-next/types/types";
import { ExcalidrawElement } from "@excalidraw/excalidraw-next/types/element/types";
import { vscode } from "./vscode";

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

const textEncoder = new TextEncoder();

function onChange(initialSceneVersion: number, contentType: string) {
  let previousSceneVersion = initialSceneVersion;
  return async (
    elements: readonly ExcalidrawElement[],
    appState: AppState,
    files: BinaryFiles
  ) => {
    const currentSceneVersion = getSceneVersion(elements);
    if (previousSceneVersion === getSceneVersion(elements)) {
      return;
    }
    previousSceneVersion = currentSceneVersion;
    if (contentType == "application/json") {
      vscode.postMessage({
        type: "change",
        content: Array.from(
          textEncoder.encode(
            serializeAsJSON(elements, appState, files, "local")
          )
        ),
      });
    } else if (contentType == "image/svg+xml") {
      const svg = await exportToSvg({
        elements,
        appState: {
          ...appState,
          exportBackground: true,
          exportEmbedScene: true,
        },
        files,
      });
      vscode.postMessage({
        type: "change",
        content: Array.from(textEncoder.encode(svg.outerHTML)),
      });
    } else if (contentType == "image/png") {
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
        vscode.postMessage({
          type: "error",
          content: "Failed to export",
        });
        return;
      }
      const arrayBuffer = await blob.arrayBuffer();
      vscode.postMessage({
        type: "change",
        content: Array.from(new Uint8Array(arrayBuffer)),
      });
    }
  };
}

export default function App(props: {
  initialData: ExcalidrawInitialDataState;
  name: string;
  contentType: string;
  theme: string;
  viewModeEnabled: boolean;
}) {
  const excalidrawRef = useRef<ExcalidrawImperativeAPI>(null);
  const libraryItemsRef = useRef(props.initialData.libraryItems || []);
  const { theme, setThemeConfig } = useTheme(props.theme);
  const onChangeRef = useRef(
    _.debounce(
      onChange(getSceneVersion(props.initialData.elements), props.contentType),
      500
    )
  );

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
        vscode.postMessage({
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
        onChange={onChangeRef.current}
        onLinkOpen={(element, event) => {
          vscode.postMessage({
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
          libraryItemsRef.current = libraryItems;
          vscode.postMessage({
            type: "library-change",
            library: serializeLibraryAsJSON(libraryItems),
          });
        }}
      />
    </div>
  );
}
