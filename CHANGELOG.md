# Changelog

## Planned

- Support for `github.dev`
- Image Support in drawings (see [excalidraw/excalidraw#4011](https://github.com/excalidraw/excalidraw/pull/4011))

### Breaking Changes

- remove glob in settings. This use-case can now be fulfilled by editing SVG files directly
- remove 2-way sync (caused issue related to editing history sync)
- remove addWatermark option. This is no longer available in the excalidraw lib

### New features

- Import libraries from [Excalidraw Libraries](https://libraries.excalidraw.com/?theme=light&sort=default)
- Add ability to edit `SVG` files directly from VSCode. Just create a file with an `.excalidraw.svg` extension
- Use native export for json files

### Fixes/Chore

- Scroll to content on new drawings
- Adopt typescript, clean react logic

## 1.3.0

### New features

- Upgrade excalidraw to 0.9.0
- Add ability to embed scene during export to SVG
- Add ability to directly embed pngs
- scrollToContent when opening a file

## 1.2.0

### New Features

- Upgrade excalidraw to 0.8.0
- Add autoSave feature (See `excalidraw.save` setting)
- Add support for workspace trust API

### Fixes

- Fix library restore of background tabs
- Disable broken import/export library buttons

## 1.1.0

### New Features

- Upgrade excalidraw to 0.7.0
  - Support tab-to-indent when editing text
- Support to save schema components into a library
- Add a setting to automatically set the output dir on export
