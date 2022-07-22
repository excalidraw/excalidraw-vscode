# Excalidraw

This extension integrates Excalidraw into VS Code.
To use it, create an empty file with a `.excalidraw`, `.excalidraw.json`, `.excalidraw.svg` or `excalidraw.png` extension and open it in VSCode.

Try the web version at : <https://excalidraw.com/>

![demo](https://raw.githubusercontent.com/excalidraw/excalidraw-vscode/master/extension/medias/screenshot.png)

## Features

### Direct Image Editing

The source of the drawing can be embedded directly in a png or svg image. Just create a new `.excalidraw.png` or `excalidraw.png` file.
You can also switch between text and image format by updating the file extension (ex: rename a `.excalidraw` file to `.excalidraw.png`).

![edit image](https://raw.githubusercontent.com/excalidraw/excalidraw-vscode/master/extension/medias/medias/edit_image.gif)

You can control the default export options using the `excalidraw.image` setting:

```json
{
  "excalidraw.image": {
    "exportScale": 1,
    "exportWithBackground": true,
    "exportWithDarkMode": false
  }
}
```

### Edit diagrams from your browser

You can install this extension in [github.dev](https://github.dev) or [vscode.dev](https://vscode.dev).
Editing an excalidraw schema stored in a github repository has never been easier !

### Switch Theme

The extension support three theme options:

- light (default)
- dark
- auto (sync with VS Code Theme)

![theme switching](https://raw.githubusercontent.com/excalidraw/excalidraw-vscode/master/extension/medias/change-theme.gif)

### Import Public Library

Check out the available libraries at [libraries.excalidraw.com](https://libraries.excalidraw.com), and don't hesitate to contribute your own !

![library import](https://raw.githubusercontent.com/excalidraw/excalidraw-vscode/master/extension/medias/import-library.gif)

### View Source

You can switch between the excalidraw editor and the source (text or image) using the editor toolbar.

![view source](https://raw.githubusercontent.com/excalidraw/excalidraw-vscode/master/extension/medias/medias/view_source.gif)

### Associate Additional Extensions With the Excalidraw Editor

By default, this extension only handles `*.excalidraw`, `*.excalidraw.svg` and `*.excalidraw.png` files.

Add this to your VS Code settings.json file if you want to associate it with additional file extensions (ex: SVG):

```json
{
  "workbench.editorAssociations": {
    "*.svg": "editor.excalidraw"
  }
}
```

You won't be able to edit arbitrary SVG files though - only those that have been created with Excalidraw or this extension!

### Sharing your Library

If you want to use a workspace specific library (and share it with other contributors), set the `excalidraw.workspaceLibraryPath` in your vscode workspace settings file (`.vscode/settings.json`):

```json
{
  "excalidraw.workspaceLibraryPath": "path/to/library.excalidrawlib"
}
```

The workspaceLibraryPath path is relative to your workspace root. Absolute path are also supported, but it will be specific to your device.

## Contact

Only bug reports / feature requests specifics to the VS Code integration should go to the extension repository. If it is not the case, please report your issue directly to the excalidraw project.

## Note for Contributors

Thank you for considering contributing to the extension :sparkling_heart: !

This extension only goal is to integrate excalidraw to the Visual Studio Code ecosystem. Users should able to use both the website and the extension with a minimal amount of friction. As such, we will not accept any contribution that significantely modify the user experience compared to the excalidraw website.

There are exception to this rule (for example, the switch theme icon was deported to vscode editor tool bar to allow a better integration). In case of uncertainty, create a thread in the project [Discussion Page](https://github.com/excalidraw/excalidraw-vscode/discussions).
