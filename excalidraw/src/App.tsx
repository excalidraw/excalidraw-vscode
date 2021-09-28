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
} from "@excalidraw/excalidraw/types/types";
import { VSCodeApi } from "./types";
import { ExcalidrawElement } from "@excalidraw/excalidraw/types/element/types";

// Either the excalidraw file or the previous state
// const previousState = vscodeApi.getState();
// const initialData = previousState
//   ? previousState
//   : (globalThis as Window).initialData;
// let {
//   elements: initialElements = [],
//   appState: intitialAppState = {},
//   libraryItems,
//   themeConfig,
//   readOnly,
// } = initialData;

// let { viewBackgroundColor: currentBackgroundColor = "#fff" } = intitialAppState;

// Used to stop unecessary updates

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

// globalThis.addEventListener("message", (e) => {
//   const message = e.data;
//   switch (message.type) {
//     case "refresh-theme":
//       if (message.theme == themeConfig) return;
//       themeConfig = message.theme;
//       updateTheme();
//       if (themeConfig == "auto")
//         observer.observe(document.body, {
//           attributes: true,
//           attributeFilter: ["class"],
//         });
//       else observer.disconnect();
//       vscode.setState({
//         elements: initialElements,
//         appState: intitialAppState,
//         themeConfig: themeConfig,
//       });
//       break;

//     case "export-to-png":
//       return;
//   }
// });

export default function App(props: {
  api: VSCodeApi;
  elements: ExcalidrawElement[];
  appState: AppState;
}) {
  const { api, elements, appState } = props;
  const excalidrawRef = useRef<ExcalidrawImperativeAPI>(null);
  const sceneVersion = useRef(getSceneVersion(elements));

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
    "export-to-svg": async (message: any) => {
      const svg = await exportToSvg({
        elements: excalidrawRef.current!.getSceneElements(),
        appState: { ...excalidrawRef.current!.getAppState() },
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
      const blob = await exportToBlob(message.exportConfig);
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
    const eventListener = (msg: { type: string }) => {
      const handler = handlers[msg.type];
      handler(msg);
    };
    globalThis.addEventListener("message", eventListener);
    return () => {
      globalThis.removeEventListener("message", eventListener);
    };
  }, []);

  const sendUpdate = debounce(
    (elements: ExcalidrawElement[], appState: AppState) => {
      // api.setState({
      //   elements: elements,
      //   appState: appState,
      // });
      const json = serializeAsJSON(elements, appState);
      api.postMessage({ type: "update", json: json });
    },
    200
  );

  return (
    <div className="excalidraw-wrapper">
      <Excalidraw
        ref={excalidrawRef}
        UIOptions={{
          canvasActions: {
            clearCanvas: false,
            export: false,
            loadScene: false,
            saveToActiveFile: false
          },
        }}
        // viewModeEnabled={readOnly}
        // theme={theme}
        initialData={{
          elements: elements,
          appState: appState,
        }}
        onLibraryChange={(items) => {
          api.postMessage({
            type: "library",
            payload: { items: items },
          });
        }}
        onChange={(elements, appState) => {
          if (getSceneVersion(elements) != sceneVersion.current) {
            sceneVersion.current = getSceneVersion(elements)
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

// const updateExtensionWithDelay = debounce(updateExtension, 250);
