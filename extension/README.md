# Excalidraw

This extension integrates Excalidraw into VS Code.
To use it, create an empty file with a `.excalidraw`, `.excalidraw.json`, `.excalidraw.svg` or `.excalidraw.png` extension and open it in Visual Studio Code.

Try the web version at : <https://excalidraw.com/>

![demo](https://raw.githubusercontent.com/excalidraw/excalidraw-vscode/master/extension/medias/screenshot.png)

- [Features](#features)
  - [Edit Images](#edit-images)
  - [Draw from your browser](#draw-from-your-browser)
  - [Switch Editor Theme](#switch-editor-theme)
  - [Import Public Library](#import-public-library)
  - [View Drawing Source](#view-drawing-source)
  - [Associate Additional Extensions with the Excalidraw Editor](#associate-additional-extensions-with-the-excalidraw-editor)
  - [Sharing your Library](#sharing-your-library)
  - [Configure Language](#configure-language)
- [Contact](#contact)
- [Note for Contributors](#note-for-contributors)

## Features

### Edit Images

The source of the drawing can be embedded directly in a PNG or SVG image. Just create a new `.excalidraw.png` or `excalidraw.png` file.
You can also switch between text and image format by updating the file extension (ex: rename a `.excalidraw` file to `.excalidraw.png`).

![Image can be edited directly](https://raw.githubusercontent.com/excalidraw/excalidraw-vscode/master/extension/medias/edit_image.gif)

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

### Draw from your browser

You can install this extension in [`github.dev`](https://github.dev) or [`vscode.dev`](https://vscode.dev).
Editing an Excalidraw schema stored in a GitHub repository has never been easier !

### Switch Editor Theme

The extension support three theme options:

- light (default)
- dark
- auto (sync with VS Code Theme)

![theme switching](https://raw.githubusercontent.com/excalidraw/excalidraw-vscode/master/extension/medias/change-theme.gif)

### Import Public Library

Check out the available libraries at [libraries.excalidraw.com](https://libraries.excalidraw.com), and don't hesitate to contribute your own !

![Public libraries can be imported from the browser](https://raw.githubusercontent.com/excalidraw/excalidraw-vscode/master/extension/medias/import-library.gif)

### View Drawing Source

You can switch between the Excalidraw editor and the source (text or image) using the editor toolbar.

![Use the dedicated toolbar button to view the diagram source](https://raw.githubusercontent.com/excalidraw/excalidraw-vscode/master/extension/medias/view_source.gif)

### Associate Additional Extensions with the Excalidraw Editor

By default, this extension only handles `*.excalidraw`, `*.excalidraw.svg` and `*.excalidraw.png` files.

Add this to your VS Code `settings.json` file if you want to associate it with additional file extensions (ex: SVG):

```json
{
  "workbench.editorAssociations": {
    "*.svg": "editor.excalidraw"
  }
}
```

You won't be able to edit arbitrary SVG files though - only those that have been created with Excalidraw or this extension!

### Sharing your Library

If you want to use a workspace specific library (and share it with other contributors), set the `excalidraw.workspaceLibraryPath` in your Visual Studio Code workspace settings file (`.vscode/settings.json`):

```json
{
  "excalidraw.workspaceLibraryPath": "path/to/library.excalidrawlib"
}
```

The `workspaceLibraryPath` path is relative to your workspace root. Absolute path are also supported, but it will be specific to your device.

### Configure Language

By default, the extension will use the [Visual Studio Code Display Language](https://code.visualstudio.com/docs/getstarted/locales) to determine the language to use. You can overwrite it using the `excalidraw.language` setting:

```json
{
  "excalidraw.language": "fr-FR"
}
```

## Contact

Only bug reports / feature requests specifics to the VS Code integration should go to the extension repository. If it is not the case, please report your issue directly to the Excalidraw project.

## Note for Contributors

Thank you for considering contributing to the extension :sparkling_heart: !

This extension only goal is to integrate Excalidraw to the Visual Studio Code ecosystem. Users should be able to use both the website and the extension with a minimal amount of friction. As such, we will not accept any contribution that significantly modify the user experience compared to the Excalidraw website.

There are exceptions to this rule (for example, the switch theme icon was deported to Visual Studio Code editor toolbar to allow a better integration). In case of uncertainty, create a thread in the project [Discussion Page](https://github.com/excalidraw/excalidraw-vscode/discussions).
