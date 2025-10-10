import * as vscode from 'vscode';
import { ConfigService } from '../services/configService';
import { StorageService } from '../services/storageService';

/**
 * Commands for managing extension configuration
 */
export class ConfigCommands {
  private static configService = ConfigService.getInstance();

  /**
   * Register all configuration commands
   */
  static register(context: vscode.ExtensionContext): vscode.Disposable[] {
    const disposables: vscode.Disposable[] = [];

    // Configuration management commands
    disposables.push(
      vscode.commands.registerCommand('flowchartMachine.config.openSettings', () => {
        ConfigCommands.openSettings();
      })
    );

    // Quick configuration commands
    disposables.push(
      vscode.commands.registerCommand('flowchartMachine.config.setPngExportLocation', () => {
        ConfigCommands.setPngExportLocation();
      })
    );

    return disposables;
  }

  /**
   * Open VS Code settings for the extension
   */
  private static openSettings(): void {
    vscode.commands.executeCommand('workbench.action.openSettings', 'flowchartMachine');
  }


  /**
   * Set PNG export location
   */
  private static async setPngExportLocation(): Promise<void> {
    const currentLocation = this.configService.get<string>('storage.export.defaultPngLocation');
    const useCustom = this.configService.get<boolean>('storage.export.useCustomPngLocation');

    // First, ask if they want to use custom location
    const useCustomSelection = await vscode.window.showQuickPick(
      ['Use Downloads folder (default)', 'Use custom folder'],
      {
        placeHolder: 'Choose PNG export location',
        ignoreFocusOut: true
      }
    );

    if (!useCustomSelection) {
        return;
    }

    if (useCustomSelection === 'Use Downloads folder (default)') {
      this.configService.set('storage.export.useCustomPngLocation', false);
      this.configService.set('storage.export.defaultPngLocation', '');
      vscode.window.showInformationMessage('PNG exports will now use your Downloads folder');
      return;
    }

    // User wants custom location
    const folderUri = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: 'Select PNG Export Folder'
    });

    if (folderUri && folderUri.length > 0) {
      const selectedPath = folderUri[0].fsPath;
      this.configService.set('storage.export.defaultPngLocation', selectedPath);
      this.configService.set('storage.export.useCustomPngLocation', true);
      vscode.window.showInformationMessage(`PNG exports will now save to: ${selectedPath}`);
    }
  }
}
