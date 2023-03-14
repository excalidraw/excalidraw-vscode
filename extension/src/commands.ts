import * as vscode from "vscode";
import * as path from "path";

function getConfigurationScope(
  config: vscode.WorkspaceConfiguration,
  key: string
) {
  const inspect = config.inspect(key);
  if (inspect?.workspaceFolderValue) {
    return vscode.ConfigurationTarget.WorkspaceFolder;
  }
  if (inspect?.workspaceValue) {
    return vscode.ConfigurationTarget.Workspace;
  }
  return vscode.ConfigurationTarget.Global;
}

async function updateTheme() {
  const excalidrawConfig = vscode.workspace.getConfiguration("excalidraw");
  const initialTheme = excalidrawConfig.get<string>("theme");
  // Todo: find out the scope of the current theme config before updating it
  const configurationScope = getConfigurationScope(excalidrawConfig, "theme");
  const updateThemeConfig = (variant: string | undefined) => {
    excalidrawConfig.update("theme", variant, configurationScope);
  };

  const quickPick = vscode.window.createQuickPick();
  const items = [
    {
      label: "light",
      description: "Always use light theme",
    },
    {
      label: "dark",
      description: "Always use dark theme",
    },
    {
      label: "auto",
      description: "Sync theme with VSCode",
    },
  ];
  quickPick.items = items;
  quickPick.activeItems = items.filter((item) => item.label === initialTheme);

  quickPick.onDidChangeActive((actives) => {
    if (actives.length > 0) {
      updateThemeConfig(actives[0].label);
    }
  });

  let confirm = false;
  quickPick.onDidAccept(() => {
    confirm = true;
    const actives = quickPick.activeItems;
    if (actives.length > 0) {
      updateThemeConfig(actives[0].label);
    } else {
      updateThemeConfig(initialTheme);
    }
    quickPick.hide();
  });
  quickPick.onDidHide(() => {
    if (!confirm) {
      updateThemeConfig(initialTheme);
    }
  });

  quickPick.show();
}

function showSource(uri: vscode.Uri, viewColumn?: vscode.ViewColumn) {
  vscode.window.showTextDocument(uri, { viewColumn });
}

function showEditor(uri: vscode.Uri, viewColumn?: vscode.ViewColumn) {
  vscode.commands.executeCommand(
    "vscode.openWith",
    uri,
    "editor.excalidraw",
    viewColumn
  );
}

function showImage(uri: vscode.Uri, viewColumn?: vscode.ViewColumn) {
  vscode.commands.executeCommand(
    "vscode.openWith",
    uri,
    "imagePreview.previewEditor",
    viewColumn
  );
}

async function createExcalidrawImage(uri: vscode.Uri, type: "png" | "svg") {
  const { path: workspacePath } = uri;

  const isFolder =
    (await vscode.workspace.fs.stat(vscode.Uri.file(workspacePath))).type ===
    vscode.FileType.Directory;

  let folderPath = workspacePath;
  if (!isFolder) {
    folderPath = workspacePath.substring(
      0,
      workspacePath.lastIndexOf(path.sep)
    );
  }

  const fileName = await vscode.window.showInputBox({
    placeHolder: "Please input filename",
  });
  if (!fileName) {
    return;
  }
  // final file name
  const FILE_NAME = `${fileName}.excalidraw.${type}`;
  // check the file has exist
  const fileIndex = (
    await vscode.workspace.fs.readDirectory(vscode.Uri.file(folderPath))
  ).findIndex((ele) => ele[0] === FILE_NAME);
  if (fileIndex !== -1) {
    vscode.window.showWarningMessage(
      `${FILE_NAME} already exists, please recreate the file `
    );
    return;
  }
  await vscode.workspace.fs.writeFile(
    vscode.Uri.file(path.resolve(folderPath, `./${FILE_NAME}`)),
    new Uint8Array()
  );
}

export function registerCommands(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand("excalidraw.updateTheme", updateTheme)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("excalidraw.showSource", showSource)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("excalidraw.showEditor", showEditor)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("excalidraw.showImage", showImage)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("excalidraw.showImageToSide", (uri) =>
      showImage(uri, vscode.ViewColumn.Beside)
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("excalidraw.showEditorToSide", (uri) =>
      showEditor(uri, vscode.ViewColumn.Beside)
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("excalidraw.showSourceToSide", (uri) =>
      showSource(uri, vscode.ViewColumn.Beside)
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("excalidraw.preventDefault", () => {})
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("excalidraw.createPngImage", (uri) => {
      createExcalidrawImage(uri, "png");
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("excalidraw.createSvgImage", (uri) => {
      createExcalidrawImage(uri, "svg");
    })
  );
}
