# Excalidraw Editor

This extension integrates Excalidraw into VS Code.
To use it, create an empty file with a `.excalidraw`, `.excalidraw.svg` or `.excalidraw.png` extension and open it in VSCode.

Try the web version at : <https://excalidraw.com/>

## Demo

![./assets/screenshot.png](https://github.com/excalidraw/excalidraw-vscode/raw/HEAD/extension/assets/screenshot.png)

## Associate Additional Extensions With The Excalidraw Editor

By default, this extension only handles `*.excalidraw.[png,svg]` files. Add this to your VS Code settings.json file if you want to associate it with .svg files:

"workbench.editorAssociations": {
    "*.svg": "editor.excalidraw",
}

You won't be able to edit arbitrary SVG files though - only those that have been created with Excalidraw or this extension!
