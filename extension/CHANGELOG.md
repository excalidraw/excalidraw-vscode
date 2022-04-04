# Changelog

## 2.0.16

- The extension is now part of the excalidraw organization !

## 2.0.10

- Allow `Excalidraw` to be used as a web extension !

## 2.0.9

- Fix `contentType` incorrectly detected ([#15](https://github.com/pomdtr/vscode-excalidraw-editor/issues/15))

## 2.0.8

- Webpack support

## 2.0.6

- Fix Assets Path

## 2.0.5

- Editor with a git URL Scheme are now read only
- Limit theme options to `excalidraw.syncTheme`

## 2.0.4

- Change Display Name to `Excalidraw Editor`

## 2.0.3

- Scroll to content in new editors

## 2.0.2

- Re-enable `excalidraw.theme`

## 2.0.0

- Upgrade `Excalidraw` to `0.11.0`
- Add Support for embedding PNG and SVG images the current file
- Add Support for directly editing SVG files (Use the extension `.excalidraw.svg`)
- Add support for links in drawings
- Deprecate `open in application` command. Please use [Open in External App](https://marketplace.visualstudio.com/items?itemName=YuTengjing.open-in-external-app) instead.
- Deprecate `excalidraw.export.globs`. Since the extension support editing SVGs directly, this is no longer necessary.
- Deprecate all SVG export using the command palette. Please use the UI button instead.
- Deprecate theme related options

## 1.3.0

- Upgrade `Excalidraw` to 0.9.0
- Add ability to embed scene during export to SVG

## 1.2.0

- Upgrade `Excalidraw` to 0.8.0
- Add `autoSave` feature (See `excalidraw.save` setting)
- Add support for workspace trust API
- Fix library restore of background tabs
- Disable broken import/export library buttons

## 1.1.0

- Upgrade `Excalidraw` to 0.7.0
  - Support tab-to-indent when editing text
- Support to save schema components into a library
- Add a setting to automatically set the output directory on export
