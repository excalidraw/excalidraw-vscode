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

Use the `Debug: Start Debugging` command to launch the extension in a new vscode window.

To inspect/debug the webview, use the `Developer: Open Webview Developer Tools` command.

### Package the extension to a vsix archive

```console
vsce package # from the extension directory
```

The vsix archive can then be installed using the `Extensions: Install from VSIX...` command

### Releasing the extension

Go to the actions tab, and trigger the bump extension version workflow.
