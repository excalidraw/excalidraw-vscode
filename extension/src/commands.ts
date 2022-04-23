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

export async function updateTheme() {
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

export function showSource(uri: vscode.Uri, viewColumn?: vscode.ViewColumn) {
  vscode.window.showTextDocument(uri, { viewColumn });
}

export function showEditor(uri: vscode.Uri, viewColumn?: vscode.ViewColumn) {
  vscode.commands.executeCommand(
    "vscode.openWith",
    uri,
    "editor.excalidraw",
    viewColumn
  );
}

export function showImage(uri: vscode.Uri, viewColumn?: vscode.ViewColumn) {
  vscode.commands.executeCommand(
    "vscode.openWith",
    uri,
    "imagePreview.previewEditor",
    viewColumn
  );
}
