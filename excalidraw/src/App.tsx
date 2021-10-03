import { useEffect, useRef, useState } from "react";
import Excalidraw, {
  exportToSvg,
  exportToBlob,
  getSceneVersion,
  serializeAsJSON,
  loadFromBlob,
  loadLibraryFromBlob,
} from "@excalidraw/excalidraw";

import "./styles.css";
import {
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types/types";
import { ExcalidrawElement } from "@excalidraw/excalidraw/types/element/types";
import { error, info, log } from "./utils";

// function getTheme() {
//   if (themeConfig != "auto") {
//     return themeConfig;
//   }
//   let newTheme = document.body.className;
//   var prefix = "vscode-";
//   if (newTheme.startsWith(prefix)) {
//     // strip prefix
//     newTheme = newTheme.substr(prefix.length);
//   }

//   if (newTheme === "high-contrast") {
//     newTheme = "dark"; // the high-contrast theme seems to be an extreme case of the dark theme
//   }

//   return newTheme;
// }

// Used by the automatic theme
// var observer = new MutationObserver(function (mutations) {
//   mutations.forEach(function (mutationRecord) {
//     updateTheme();
//   });
// });

const storableProperties: string[] = [
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
]

export default function App(props: {
  "api": any;
  initialData: any,
  documentType: string;
  config: {
    zenModeEnabled?: boolean,
    viewModeEnabled?: boolean,
    theme: "dark" | "light"
  }
}) {
  const { api, initialData, documentType,  } = props;
  const excalidrawRef = useRef<ExcalidrawImperativeAPI>(null);
  const sceneVersion = useRef(getSceneVersion(initialData.elements));
  const [config, setConfig] = useState(props.config)

  const handlers: Record<string, any> = {
    update: async (message: any) => {
      const { json } = message.payload;
      const blob = new Blob(json, { type: "application/json" });
      const { appState, elements } = await loadFromBlob(blob, null, null);
      if (sceneVersion.current != getSceneVersion(elements)) {
        sceneVersion.current = getSceneVersion(elements);
        excalidrawRef.current!.updateScene({
          elements: elements,
          appState: appState,
        });
      }
    },
    "set-config": async (message: any) => {
      const newConfig = message.config
      setConfig({config, ...newConfig})
    },
    "import-library-url": async (message: any) => {
      try {
        excalidrawRef.current!.importLibrary(message.url, message.token)
      } catch (e: any) {
        error(api, e.toString())
      }
    },
    "export-to-svg": async (message: any) => {
      const svg = await exportToSvg({
        elements: excalidrawRef.current!.getSceneElements(),
        appState: { ...excalidrawRef.current!.getAppState(), ...message.exportConfig },
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
        appState: {...excalidrawRef.current!.getAppState(), ...message.exportConfig},
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
      const msg = e.data
      const handler = handlers[msg.type];
      handler(msg);
    };
    globalThis.addEventListener("message", eventListener);
    return () => {
      globalThis.removeEventListener("message", eventListener);
    };
  }, []);

  const sendUpdate = debounce(
    async (elements: ExcalidrawElement[], appState: Record<string, any>) => {
      const cleanedAppState: Record<string, any> = {}
      for (const property of storableProperties) {
        cleanedAppState[property] = appState[property]
      }
      api.setState({
        initialData: {
          elements,
          appState: cleanedAppState,
        },
        documentType,
        config
      });
      let content: string | undefined;
      let svg: SVGSVGElement | undefined;
      if (documentType == "application/json") {
        content = serializeAsJSON(elements, appState);
      } else {
        svg = await exportToSvg({
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
    },
    200
  );

  return (
    <div className="excalidraw-wrapper">
      <Excalidraw
        ref={excalidrawRef}
        zenModeEnabled={config.zenModeEnabled}
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
        viewModeEnabled={config.viewModeEnabled}
        theme={config.theme}
        initialData={initialData}
        onLibraryChange={(items) => {
          api.postMessage({
            type: "library",
            payload: { items: items },
          });
        }}
        onChange={(elements, appState) => {
          if (getSceneVersion(elements) != sceneVersion.current) {
            sceneVersion.current = getSceneVersion(elements);
            sendUpdate(elements as ExcalidrawElement[], appState);
          }
        }}
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
