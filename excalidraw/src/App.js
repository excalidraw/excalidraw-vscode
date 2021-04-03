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
      if (currentSceneVersion != getSceneVersion(elements)) {
        currentSceneVersion = getSceneVersion(elements);
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
  const [dimensions, setDimensions] = useState({
    width: undefined,
    height: undefined,
  });

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

  useEffect(() => {
    setDimensions({
      width: excalidrawWrapperRef.current.getBoundingClientRect().width,
      height: excalidrawWrapperRef.current.getBoundingClientRect().height,
    });
    const onResize = () => {
      setDimensions({
        width: excalidrawWrapperRef.current.getBoundingClientRect().width,
        height: excalidrawWrapperRef.current.getBoundingClientRect().height,
      });
    };

    window.addEventListener("resize", onResize);

    return () => window.removeEventListener("resize", onResize);
  }, [excalidrawWrapperRef]);

  return (
    <div className="excalidraw-wrapper" ref={excalidrawWrapperRef}>
      <Excalidraw
        ref={excalidrawRef}
        viewModeEnabled={readOnly}
        width={dimensions.width}
        height={dimensions.height}
        theme={theme}
        initialData={{ elements: initialElements, appState: intitialAppState }}
        onChange={(_, appState) => {

          updateExtensionWithDelay({
            elements: excalidrawRef.current.getSceneElements(),
            appState: appState,
          });
        }}
        name="Custom name of drawing"
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

// Remove default save shortcut for excalidraw
document.addEventListener("keydown", function (e) {
  if ((e.metaKey || e.ctrlKey) && e.key == "s") {
    e.cancelBubble = true;
    e.stopImmediatePropagation();
    postMessage({ type: "save" });
  }
  return false;
});

function postMessage(msg) {
  vscode.postMessage(msg);
}
function log(msg) {
  vscode.postMessage({ type: "log", msg: msg });
}
