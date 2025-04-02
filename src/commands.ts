import * as vscode from "vscode";

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

async function newFile() {
  const newFileUri = await vscode.window.showSaveDialog({
    filters: {
      Excalidraw: [
        "excalidraw",
        "excalidraw.png",
        "excalidraw.svg",
        "excalidraw.json",
      ],
      "Excalidraw Png": ["excalidraw.png"],
      "Excalidraw Svg": ["excalidraw.svg"],
      "Excalidraw Json": ["excalidraw.json"],
    },
  });

  if (!newFileUri) {
    return;
  }

  try {
    // create a new file with an empty content to avoid further issues with content detection
    await vscode.workspace.fs.writeFile(newFileUri, new Uint8Array());

    await vscode.commands.executeCommand(
      "vscode.openWith",
      newFileUri,
      "editor.excalidraw"
    );
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to create new file: ${error}`);
  }
}

export function registerCommands(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand("excalidraw.newFile", newFile)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("excalidraw.newSceneFile", newFile)
  );
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
    vscode.commands.registerCommand("excalidraw.preventDefault", () => { })
  );
}
