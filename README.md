# Excalidraw Editor

This unofficial extension integrates Excalidraw into VS Code.
To use it, create an empty file with an .excalidraw extension and open it in VSCode.

Try the official web version at [Excalidraw.com](https://excalidraw.com/)

![home](doc/home.jpg)

- [Features](#features)
  - [Export to PNG/SVG](#export-to-pngsvg)
  - [Directly edit SVG files](#directly-edit-svg-files)
  - [Integration with Git](#integration-with-git)
  - [Automatic Dark/Light Theme](#automatic-darklight-theme)
  - [Switch between VS Code and Excalidraw Progressive Web App](#switch-between-vs-code-and-excalidraw-progressive-web-app)
- [Missing Features](#missing-features)
- [See Also / Credits](#see-also--credits)
- [Similar Extensions](#similar-extensions)

## Features

### Export to PNG/SVG

![Export](doc/export.gif)

Excalidraw Commands:

- `Excalidraw: Export to svg`
- `Excalidraw: Export to png`
- `Excalidraw: Export Options`

### Directly edit SVG files

Create an empty file with an `.excalidraw.svg` extension to get started.

To use excalidraw as the default editor for `excalidraw.svg` files, add this to your settings:

```json
"workbench.editorAssociations": {
  "*.excalidraw.svg": "editor.excalidraw",
},
```

### Integration with Git

![SCM](doc/scm.jpg)

Quickly preview change between commits.

### Automatic Dark/Light Theme

![Automatic Theme](doc/theme.gif)

Use the `Exalidraw: Color Theme` command to switch theme.

### Switch between VS Code and Excalidraw Progressive Web App

Use the `Excalidraw: Open in Application` command to edit your schema in Excalidraw PWA.

Instruction to install Excalidraw as a PWA :

![Switch to the Desktop Application](doc/pwa.gif)

## Missing Features

- Collaboration: The extension should work in Live Share, but the native excalidraw collaboration is not supported
- Export as Link: This requires a connexion to Excalidraw servers, this extension run locally

However, you can gain access all of these features by [switching to the PWA](#switch-between-vs-code-and-excalidraw-pwa)

## See Also / Credits

- [Excalidraw project](https://github.com/excalidraw/excalidraw): My favorite open source drawing app <3
- [Draw.io VS Code integration](https://marketplace.visualstudio.com/items?itemName=hediet.vscode-drawio): Huge source of inspiration, go checkout `@hediet` work !
- [Roam Excalidraw](https://roam-excalidraw.com/): Existing integration in Roam Research, another source of inspiration
- [Marp](https://marketplace.visualstudio.com/items?itemName=marp-team.marp-vscode): this extension was built to be able to easily integrate schemas to my marp slides

## Similar Extensions

There are already excalidraw extensions in VSCode, but none of them use the excalidraw NPM package.
It should be quicker to integrate new features using the officially provided component !

- [Excalidraw Integration](https://marketplace.visualstudio.com/items?itemName=brijeshb42.vscode-excalidraw)
- [Excalidraw VSCode Plugin](https://marketplace.visualstudio.com/items?itemName=jkchao.vscode-excalidraw-plugin)
