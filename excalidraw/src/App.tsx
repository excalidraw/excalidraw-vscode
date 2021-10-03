import { useEffect, useRef, useState } from "react";
import Excalidraw, {
  exportToSvg,
  exportToBlob,
  getSceneVersion,
  serializeAsJSON,
  loadFromBlob,
} from "@excalidraw/excalidraw";

import "./styles.css";
import {
  AppState,
  ExcalidrawImperativeAPI,
  LibraryItems,
} from "@excalidraw/excalidraw/types/types";
import { ExcalidrawElement } from "@excalidraw/excalidraw/types/element/types";
import { error, log } from "./utils";

export type VscodeAPI = {
  postMessage: (msg: Record<string, any>) => void;
  getState: () => ExcalidrawState | undefined;
  setState: (state: ExcalidrawState) => void;
};

export type ExcalidrawInitialData = {
  elements: ExcalidrawElement[];
  appState: any;
  scrollToContent: boolean;
  libraryItems: LibraryItems;
};

export type ExcalidrawState = {
  initialData: ExcalidrawInitialData;
  documentType: "application/json" | "image/svg+xml";
  viewModeEnabled: boolean;
  theme: ExcalidrawTheme;
};

function findAutomaticTheme(vscodeTheme: string): "light" | "dark" {
  switch (vscodeTheme) {
    case "vscode-light":
      return "light";
    case "vscode-dark":
      return "dark";
    case "vscode-high-contrast":
      return "dark";
    default:
      return "light";
  }
}

const storableProperties = [
  "theme",
  "currentChartType",
  "currentItemBackgroundColor",
  "currentItemEndArrowhead",
  "currentItemFillStyle",
  "currentItemFontFamily",
  "currentItemFontSize",
  "currentItemLinearStrokeSharpness",
  "currentItemOpacity",
  "currentItemRoughness",
  "currentItemStartArrowhead",
  "currentItemStrokeColor",
  "currentItemStrokeSharpness",
  "currentItemStrokeStyle",
  "currentItemStrokeWidth",
  "currentItemTextAlign",
  "cursorButton",
  "editingGroupId",
  "elementLocked",
  "elementType",
  "exportBackground",
  "exportEmbedScene",
  "exportScale",
  "exportWithDarkMode",
  "gridSize",
  "lastPointerDownWith",
  "name",
  "openMenu",
  "previousSelectedElementIds",
  "scrolledOutside",
  "scrollX",
  "scrollY",
  "selectedElementIds",
  "selectedGroupIds",
  "shouldCacheIgnoreZoom",
  "showStats",
  "viewBackgroundColor",
  "zenModeEnabled",
  "zoom",
];

function useTheme(
  initialExcalidrawTheme: ExcalidrawTheme,
  initialVscodeTheme: string
) {
  const [excalidrawTheme, setExcalidrawTheme] = useState(
    initialExcalidrawTheme
  );
  const [vscodeTheme, setVSCodeTheme] = useState(initialVscodeTheme);

  if (excalidrawTheme != "auto")
    return { theme: excalidrawTheme, setExcalidrawTheme, setVSCodeTheme };
  return {
    theme: findAutomaticTheme(vscodeTheme),
    setExcalidrawTheme,
    setVSCodeTheme,
  };
}

export function App(props: {
  api: VscodeAPI;
  initialData: ExcalidrawInitialData;
  documentType: ExcalidrawType;
  viewModeEnabled: boolean;
  theme: ExcalidrawTheme;
}) {
  const { api, initialData, documentType, viewModeEnabled } = props;
  const excalidrawRef = useRef<ExcalidrawImperativeAPI>(null);
  const sceneVersion = useRef(getSceneVersion(initialData.elements));
  const viewBackgroundColor = useRef<string>(
    initialData.appState.viewBackgroundColor
  );
  const libraryItems = useRef<LibraryItems>(initialData.libraryItems)
  const { theme, setExcalidrawTheme, setVSCodeTheme } = useTheme(
    props.theme,
    document.body.className
  );

  const handlers: Record<string, any> = {
    "set-theme": async (message: any) => {
      setExcalidrawTheme(message.theme);
    },
    "import-library-url": async (message: any) => {
      try {
        excalidrawRef.current!.importLibrary(message.url, message.token);
      } catch (e: any) {
        error(api, e.toString());
      }
    },
    "export-to-svg": async (message: any) => {
      const svg = await exportToSvg({
        elements: excalidrawRef.current!.getSceneElements(),
        appState: {
          ...excalidrawRef.current!.getAppState(),
          ...message.exportConfig,
        },
      });
      api.postMessage({
        type: "svg-export",
        payload: {
          svg: svg.outerHTML,
          path: message.path,
        },
      });
    },
    "export-to-png": async (message: any) => {
      const blob = await exportToBlob({
        elements: excalidrawRef.current!.getSceneElements(),
        appState: {
          ...excalidrawRef.current!.getAppState(),
          ...message.exportConfig,
        },
      });
      var reader = new FileReader();
      if (!blob) return;
      reader.readAsDataURL(blob);
      reader.onloadend = function () {
        var base64data = reader.result;
        api.postMessage({
          type: "png-export",
          payload: {
            png: base64data,
            path: message.path,
          },
        });
      };
    },
  };

  useEffect(() => {
    const eventListener = (e: any) => {
      const msg = e.data;
      const handler = handlers[msg.type];
      handler(msg);
    };
    globalThis.addEventListener("message", eventListener);
    return () => {
      globalThis.removeEventListener("message", eventListener);
    };
  }, []);

  useEffect(() => {
    var observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (_) {
        setVSCodeTheme(document.body.className);
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

  const sendUpdate = async (elements: any, appState: any) => {
      let content: string | undefined;
      if (documentType == "application/json")
        content = serializeAsJSON(elements, appState);
      else {
        const svg = await exportToSvg({
          elements,
          appState: {
            ...appState,
            exportEmbedScene: true,
            exportBackground: true,
          },
        });
        content = svg.outerHTML;
      }
      api.postMessage({ type: "update", json: content });

  }

  const onChange = debounce(
    async (elements: readonly ExcalidrawElement[], appState: AppState) => {
      const cleanedAppState: Record<string, any> = {};
      for (const property of storableProperties) {
        cleanedAppState[property] = appState[property as keyof AppState];
      }
      api.setState({
        initialData: {
          elements: elements as ExcalidrawElement[],
          appState: cleanedAppState,
          scrollToContent: false,
          libraryItems: libraryItems.current,
        },
        viewModeEnabled: viewModeEnabled,
        documentType,
        theme,
      });

      if (
        getSceneVersion(elements) != sceneVersion.current ||
        appState.viewBackgroundColor != viewBackgroundColor.current
      ) {
        sceneVersion.current = getSceneVersion(elements);
        viewBackgroundColor.current = appState.viewBackgroundColor;
        sendUpdate(elements, appState);
      }
    },
    500
  );

  return (
    <div className="excalidraw-wrapper">
      <Excalidraw
        ref={excalidrawRef}
        autoFocus={true}
        libraryReturnUrl={"vscode://pomdtr.excalidraw-editor/importLib"}
        UIOptions={{
          canvasActions: {
            clearCanvas: false,
            export: false,
            loadScene: false,
            saveToActiveFile: false,
          },
        }}
        theme={theme}
        viewModeEnabled={viewModeEnabled}
        initialData={initialData}
        onLibraryChange={(items) => {
          libraryItems.current = items
          api.postMessage({
            type: "library-update",
            items,
          });
        }}
        onChange={onChange}
      />
    </div>
  );
}

export function debounce<T extends unknown[], U>(
  callback: (...args: T) => PromiseLike<U> | U,
  wait: number
) {
  let timer: NodeJS.Timeout;

  return (...args: T): Promise<U> => {
    clearTimeout(timer);
    return new Promise((resolve) => {
      timer = setTimeout(() => resolve(callback(...args)), wait);
    });
  };
}
