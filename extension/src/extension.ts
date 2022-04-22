import * as vscode from "vscode";
import { ExcalidrawEditor, ExcalidrawEditorProvider } from "./ExcalidrawEditor";

export async function activate(context: vscode.ExtensionContext) {
  // Register our custom editor providers
  context.subscriptions.push(await ExcalidrawEditorProvider.register(context));
  context.subscriptions.push(ExcalidrawUriHandler.register());
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "excalidraw.theme.update",
      updateThemeConfig
    )
  );
}

class ExcalidrawUriHandler implements vscode.UriHandler {
  public static register() {
    const provider = new ExcalidrawUriHandler();
    const providerRegistration = vscode.window.registerUriHandler(provider);
    return providerRegistration;
  }

  public async handleUri(uri: vscode.Uri) {
    try {
      const hash = new URLSearchParams(uri.fragment);
      const libraryUrl = hash.get("addLibrary");
      const csrfToken = hash.get("token");
      if (libraryUrl && csrfToken) {
        ExcalidrawEditor.importLibrary(libraryUrl, csrfToken);
        vscode.window.showInformationMessage("Library added successfully!");
      }
    } catch (e) {
      console.error(e);
    }
  }
}

async function updateThemeConfig() {
  const excalidrawConfig = vscode.workspace.getConfiguration("excalidraw");
  const initialTheme = excalidrawConfig.get<string>("theme");
  const updateTheme = (variant: string | undefined) => {
    excalidrawConfig.update(
      "theme",
      variant,
      vscode.ConfigurationTarget.Global
    );
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
      updateTheme(actives[0].label);
    }
  });

  let confirm = false;
  quickPick.onDidAccept(() => {
    confirm = true;
    const actives = quickPick.activeItems;
    if (actives.length > 0) {
      updateTheme(actives[0].label);
    } else {
      updateTheme(initialTheme);
    }
    quickPick.hide();
  });
  quickPick.onDidHide(() => {
    if (!confirm) {
      updateTheme(initialTheme);
    }
  });

  quickPick.show();
}
