import React, { useEffect, useState, useRef } from "react";
import Excalidraw, {
  exportToSvg,
  exportToBlob,
  getSceneVersion,
} from "@excalidraw/excalidraw";

import "./styles.css";

const vscode = window.acquireVsCodeApi();

// Either the excalidraw file or the previous state
const previousState = vscode.getState();
const initialData = previousState ? previousState : window.initialData;
let {
  elements: initialElements = [],
  appState: intitialAppState = {},
  libraryItems,
  themeConfig,
  readOnly
} = initialData;

let { viewBackgroundColor: currentBackgroundColor = "#fff" } = intitialAppState

// placeholder for functions
let updateApp = null;
let toSVG = null;
let toPNG = null;
let updateTheme = null;

// Used to stop unecessary updates
let currentSceneVersion = getSceneVersion(initialElements);

function getTheme() {
  if (themeConfig != "auto") {
    return themeConfig;
  }
  let newTheme = document.body.className;
  var prefix = "vscode-";
  if (newTheme.startsWith(prefix)) {
    // strip prefix
    newTheme = newTheme.substr(prefix.length);
  }

  if (newTheme === "high-contrast") {
    newTheme = "dark"; // the high-contrast theme seems to be an extreme case of the dark theme
  }

  return newTheme;
}

// Used by the automatic theme
var observer = new MutationObserver(function (mutations) {
  mutations.forEach(function (mutationRecord) {
    updateTheme();
  });
});

window.addEventListener("message", (e) => {
  const message = e.data;
  switch (message.type) {
    case "update":
      const { elements, appState } = message;
      if (currentSceneVersion != getSceneVersion(elements) || appState.viewBackgroundColor != currentBackgroundColor) {
        currentSceneVersion = getSceneVersion(elements);
        currentBackgroundColor = appState.viewBackgroundColor;
        updateApp({ elements: elements, appState: appState });
      }
      return;
    case "refresh-theme":
      if (message.theme == themeConfig)
        return
      themeConfig = message.theme;
      updateTheme();
      if (themeConfig == "auto")
        observer.observe(document.body, {
          attributes: true,
          attributeFilter: ["class"],
        });
      else observer.disconnect();
      vscode.setState({
        elements: initialElements,
        appState: intitialAppState,
        themeConfig: themeConfig,
      });
      break;

    case "export-to-svg":
      postMessage({
        type: "svg-export",
        svg: toSVG(message.exportConfig).outerHTML,
        path: message.path,
      });
      return;
    case "export-to-png":
      toPNG(message.exportConfig).then((blob) => {
        var reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = function () {
          var base64data = reader.result;
          postMessage({
            type: "png-export",
            png: base64data,
            path: message.path,
          });
        };
      });
      return;
  }
});

export default function App() {
  const excalidrawRef = useRef(null);
  const [theme, setTheme] = useState(getTheme());
  const excalidrawWrapperRef = useRef(null);

  useEffect(() => {
    vscode.postMessage({ type: 'init' })
  })

  updateTheme = () => {
    setTheme(getTheme());
  };

  updateApp = ({ elements, appState }) => {
    excalidrawRef.current.updateScene({
      elements: elements,
      appState: appState,
    });
  };

  toSVG = (exportParams) => {
    return exportToSvg({
      elements: excalidrawRef.current.getSceneElements(),
      appState: { ...excalidrawRef.current.getAppState(), ...exportParams },
    });
  };

  toPNG = (exportParams) => {
    return exportToBlob({
      elements: excalidrawRef.current.getSceneElements(),
      appState: { ...excalidrawRef.current.getAppState(), ...exportParams },
    });
  };

  return (
    <div className="excalidraw-wrapper" ref={excalidrawWrapperRef}>
      <Excalidraw
        ref={excalidrawRef}
        UIOptions={{ canvasActions: { clearCanvas: false, export: false, loadScene: false, saveScene: false } }}
        viewModeEnabled={readOnly}
        theme={theme}
        initialData={{ elements: initialElements, appState: intitialAppState, libraryItems: libraryItems }}
        onLibraryChange={
          (items) => {
            vscode.postMessage({type: 'library', items: items})
          }
        }
        onChange={(_, appState) => {

          updateExtensionWithDelay({
            elements: excalidrawRef.current.getSceneElements(),
            appState: appState,
          });
        }}
      />
    </div>
  );
}

function debounce(func, wait, immediate) {
  var timeout;
  return function () {
    var context = this,
      args = arguments;
    var later = function () {
      timeout = null;
      if (!immediate) func.apply(context, args);
    };
    var callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) func.apply(context, args);
  };
}

// We used the debounce utility to limit the number of update to Vscode
function updateExtension({ elements, appState }) {
  const {
    viewBackgroundColor,
    zenModeEnabled,
    viewModeEnabled,
    gridSize,
    scrollX,
    scrollY,
    theme,
    exportBackground,
    exportEmbedScene,
    exportWithDarkMode,
    elementLocked,
    zoom,
  } = appState;
  vscode.setState({
    elements: elements,
    themeConfig: themeConfig,
    libraryItems: libraryItems,
    appState: {
      viewBackgroundColor: viewBackgroundColor,
      zenModeEnabled: zenModeEnabled,
      viewModeEnabled: viewModeEnabled,
      gridSize: gridSize,
      scrollX: scrollX,
      scrollY: scrollY,
      theme: theme,
      exportBackground: exportBackground,
      exportEmbedScene: exportEmbedScene,
      exportWithDarkMode: exportWithDarkMode,
      elementLocked: elementLocked,
      zoom: zoom,
    },
  });
  let newSceneVersion = getSceneVersion(elements);
  if (newSceneVersion != currentSceneVersion || currentBackgroundColor != appState.viewBackgroundColor) {
    currentSceneVersion = newSceneVersion;
    currentBackgroundColor = appState.viewBackgroundColor
    postMessage({
      type: "update",
      elements: elements,
      appState: {
        viewBackgroundColor: viewBackgroundColor,
        gridSize: gridSize,
        scrollX: scrollX,
        scrollY: scrollY,
        zoom: zoom,
      },
    });
  }
}
const updateExtensionWithDelay = debounce(updateExtension, 250, false);

function postMessage(msg) {
  vscode.postMessage(msg);
}
function log(msg) {
  vscode.postMessage({ type: "log", msg: msg });
}
