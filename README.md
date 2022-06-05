# Excalidraw VSCode Extension

## Development

### Requirements

- [Node.js](https://nodejs.org/en/)
- [vsce](https://github.com/microsoft/vscode-vsce)

### Install the dependencies

```bash
npm install # from the extension directory
```

### Run the extension

Use the `Debug: Start Debugging Command` to launch the extension in a new vscode window.

To inspect/debug the webview, use the `Developer: Open Webview Developer tools command`.

### Package the extension to a vsix archive

```console
vsce package # from the extension directory
```

The vsix archive can then be installed using the `Extensions: Install from VSIX...` command

### Releasing the extension

```console
./release-extension.sh (major|minor|patch) # update manifest, creates commit and tag
```

The extension will be published to the vscode and open-vsx marketplaces using github actions on push.
