# Excalidraw VSCode Extension

## Development

### Requirements

- [Node.js](https://nodejs.org/en/)
- [vsce](https://github.com/microsoft/vscode-vsce)

This repository contains a [workspace file](./excalidraw-vscode.code-workspace).
In order to run the extension wou will need to open it using the `File: Open Workspace from File` command.

### Install the dependencies

```bash
npm install # from the extension directory
```

### Run the extension

Use the `Debug: Start Debugging Command` to launch the extension in a new vscode window.

To inspect/debug the webview, use the `Developer: Open Webview Developer tools command`.

### Package the extension to a vsix archive

```console
vsce package
```

The vsix archive can then be installed using the `Extensions: Install from VSIX...` command
