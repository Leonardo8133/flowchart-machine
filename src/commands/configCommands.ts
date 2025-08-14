import * as vscode from 'vscode';
import { ConfigService } from '../services/configService';
import { StorageService } from '../services/storageService';

/**
 * Commands for managing extension configuration
 */
export class ConfigCommands {
  private static configService = ConfigService.getInstance();
  private static storageService = StorageService.getInstance();

  /**
   * Register all configuration commands
   */
  static register(context: vscode.ExtensionContext): vscode.Disposable[] {
    const disposables: vscode.Disposable[] = [];

    // Configuration management commands
    disposables.push(
      vscode.commands.registerCommand('flowchartMachine.config.openSettings', () => {
        ConfigCommands.openSettings();
      }),
      vscode.commands.registerCommand('flowchartMachine.config.resetToDefaults', () => {
        ConfigCommands.resetToDefaults();
      }),
      vscode.commands.registerCommand('flowchartMachine.config.export', () => {
        ConfigCommands.exportConfig();
      }),
      vscode.commands.registerCommand('flowchartMachine.config.import', () => {
        ConfigCommands.importConfig();
      }),
      vscode.commands.registerCommand('flowchartMachine.config.showCurrent', () => {
        ConfigCommands.showCurrentConfig();
      })
    );

    // Storage management commands
    disposables.push(
      vscode.commands.registerCommand('flowchartMachine.storage.showSaved', () => {
        ConfigCommands.showSavedFlowcharts();
      }),
      vscode.commands.registerCommand('flowchartMachine.storage.exportAll', () => {
        ConfigCommands.exportAllFlowcharts();
      }),
      vscode.commands.registerCommand('flowchartMachine.storage.import', () => {
        ConfigCommands.importFlowcharts();
      }),
      vscode.commands.registerCommand('flowchartMachine.storage.showStats', () => {
        ConfigCommands.showStorageStats();
      }),
      vscode.commands.registerCommand('flowchartMachine.storage.cleanup', () => {
        ConfigCommands.cleanupStorage();
      })
    );

    // Quick configuration commands
    disposables.push(
      vscode.commands.registerCommand('flowchartMachine.config.toggleAutoSave', () => {
        ConfigCommands.toggleAutoSave();
      }),
      vscode.commands.registerCommand('flowchartMachine.config.toggleProgress', () => {
        ConfigCommands.toggleProgress();
      }),
      vscode.commands.registerCommand('flowchartMachine.config.setMaxNodes', () => {
        ConfigCommands.setMaxNodes();
      }),
      vscode.commands.registerCommand('flowchartMachine.config.setMaxFileSize', () => {
        ConfigCommands.setMaxFileSize();
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
   * Reset configuration to defaults
   */
  private static resetToDefaults(): void {
    vscode.window.showWarningMessage(
      'Are you sure you want to reset all configuration to defaults?',
      'Yes', 'No'
    ).then(selection => {
      if (selection === 'Yes') {
        this.configService.resetToDefaults();
      }
    });
  }

  /**
   * Export configuration to file
   */
  private static async exportConfig(): Promise<void> {
    await this.configService.exportConfig();
  }

  /**
   * Import configuration from file
   */
  private static async importConfig(): Promise<void> {
    await this.configService.importConfig();
  }

  /**
   * Show current configuration in a webview
   */
  private static showCurrentConfig(): void {
    const config = this.configService.getConfig();
    const panel = vscode.window.createWebviewPanel(
      'flowchartConfig',
      'Flowchart Machine Configuration',
      vscode.ViewColumn.One,
      { enableScripts: true }
    );

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Configuration</title>
        <style>
          body { font-family: var(--vscode-font-family); padding: 20px; }
          .section { margin-bottom: 30px; }
          .section h3 { color: var(--vscode-textPreformat-foreground); border-bottom: 1px solid var(--vscode-textPreformat-foreground); }
          .config-item { margin: 10px 0; padding: 10px; background: var(--vscode-textBlockQuote-background); border-radius: 4px; }
          .config-key { font-weight: bold; color: var(--vscode-textPreformat-foreground); }
          .config-value { margin-left: 10px; color: var(--vscode-textPreformat-foreground); }
          .boolean { color: var(--vscode-textPreformat-foreground); }
          .number { color: var(--vscode-textPreformat-foreground); }
          .string { color: var(--vscode-textPreformat-foreground); }
        </style>
      </head>
      <body>
        <h1>Flowchart Machine Configuration</h1>
        <div class="section">
          <h3>General Settings</h3>
          <div class="config-item">
            <span class="config-key">Auto Save:</span>
            <span class="config-value boolean">${config.general.autoSave}</span>
          </div>
          <div class="config-item">
            <span class="config-key">Default Format:</span>
            <span class="config-value string">${config.general.defaultFormat}</span>
          </div>
          <div class="config-item">
            <span class="config-key">Show Progress:</span>
            <span class="config-value boolean">${config.general.showProgress}</span>
          </div>
          <div class="config-item">
            <span class="config-key">Auto Open Webview:</span>
            <span class="config-value boolean">${config.general.autoOpenWebview}</span>
          </div>
        </div>
        <div class="section">
          <h3>Node Processing</h3>
          <div class="config-item">
            <span class="config-key">Functions:</span>
            <span class="config-value boolean">${config.nodes.processTypes.functions}</span>
          </div>
          <div class="config-item">
            <span class="config-key">Function Calls:</span>
            <span class="config-value boolean">${config.nodes.processTypes.functionCalls}</span>
          </div>
          <div class="config-item">
            <span class="config-key">Assignments:</span>
            <span class="config-value boolean">${config.nodes.processTypes.assignments}</span>
          </div>
          <div class="config-item">
            <span class="config-key">Max Depth:</span>
            <span class="config-value number">${config.nodes.maxDepth}</span>
          </div>
        </div>
        <div class="section">
          <h3>Performance</h3>
          <div class="config-item">
            <span class="config-key">Max Nodes:</span>
            <span class="config-value number">${config.performance.maxNodes}</span>
          </div>
          <div class="config-item">
            <span class="config-key">Max File Size (KB):</span>
            <span class="config-value number">${config.performance.maxFileSize}</span>
          </div>
          <div class="config-item">
            <span class="config-key">Script Timeout (s):</span>
            <span class="config-value number">${config.performance.scriptTimeout}</span>
          </div>
        </div>
        <div class="section">
          <h3>Storage</h3>
          <div class="config-item">
            <span class="config-key">Save Flowcharts:</span>
            <span class="config-value boolean">${config.storage.saveFlowcharts}</span>
          </div>
          <div class="config-item">
            <span class="config-key">Max Saved:</span>
            <span class="config-value number">${config.storage.maxSavedFlowcharts}</span>
          </div>
          <div class="config-item">
            <span class="config-key">Storage Location:</span>
            <span class="config-value string">${config.storage.storageLocation}</span>
          </div>
        </div>
        <p><em>Use "Open Settings" command to modify these values</em></p>
      </body>
      </html>
    `;

    panel.webview.html = html;
  }

  /**
   * Show saved flowcharts in a webview
   */
  private static showSavedFlowcharts(): void {
    const flowcharts = this.storageService.getAllFlowcharts();
    const panel = vscode.window.createWebviewPanel(
      'savedFlowcharts',
      'Saved Flowcharts',
      vscode.ViewColumn.One,
      { enableScripts: true }
    );

    if (flowcharts.length === 0) {
      panel.webview.html = `
        <!DOCTYPE html>
        <html>
        <head><title>Saved Flowcharts</title></head>
        <body>
          <h1>No Saved Flowcharts</h1>
          <p>No flowcharts have been saved yet. Generate a flowchart with auto-save enabled to see them here.</p>
        </body>
        </html>
      `;
      return;
    }

    const flowchartHtml = flowcharts.map(f => `
      <div style="border: 1px solid var(--vscode-textPreformat-foreground); margin: 10px 0; padding: 15px; border-radius: 4px;">
        <h3>${f.sourceFile.split('/').pop()}</h3>
        <p><strong>Created:</strong> ${f.createdAt.toLocaleDateString()}</p>
        <p><strong>Last Accessed:</strong> ${f.lastAccessed.toLocaleDateString()}</p>
        <p><strong>Nodes:</strong> ${f.flowchart.metadata.nodeCount}</p>
        <p><strong>Tags:</strong> ${f.tags.join(', ') || 'None'}</p>
        ${f.notes ? `<p><strong>Notes:</strong> ${f.notes}</p>` : ''}
      </div>
    `).join('');

    panel.webview.html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Saved Flowcharts</title>
        <style>
          body { font-family: var(--vscode-font-family); padding: 20px; }
          .flowchart { border: 1px solid var(--vscode-textPreformat-foreground); margin: 10px 0; padding: 15px; border-radius: 4px; }
        </style>
      </head>
      <body>
        <h1>Saved Flowcharts (${flowcharts.length})</h1>
        ${flowchartHtml}
      </body>
      </html>
    `;
  }

  /**
   * Export all saved flowcharts
   */
  private static async exportAllFlowcharts(): Promise<void> {
    await this.storageService.exportAllFlowcharts();
  }

  /**
   * Import flowcharts from file
   */
  private static async importFlowcharts(): Promise<void> {
    await this.storageService.importFlowcharts();
  }

  /**
   * Show storage statistics
   */
  private static showStorageStats(): void {
    const stats = this.storageService.getStorageStats();
    
    const message = `Storage Statistics:
• Total Flowcharts: ${stats.totalFlowcharts}
• Total Size: ${(stats.totalSize / 1024).toFixed(2)} KB
• Oldest: ${stats.oldestFlowchart ? stats.oldestFlowchart.toLocaleDateString() : 'None'}
• Newest: ${stats.newestFlowchart ? stats.newestFlowchart.toLocaleDateString() : 'None'}
• Most Used Tags: ${stats.mostUsedTags.slice(0, 3).map(t => `${t.tag} (${t.count})`).join(', ') || 'None'}`;

    vscode.window.showInformationMessage(message);
  }

  /**
   * Clean up old flowcharts
   */
  private static async cleanupStorage(): Promise<void> {
    vscode.window.showWarningMessage(
      'This will remove old flowcharts based on your cleanup settings. Continue?',
      'Yes', 'No'
    ).then(selection => {
      if (selection === 'Yes') {
        // Trigger cleanup
        this.storageService['cleanupOldFlowcharts']();
        vscode.window.showInformationMessage('Storage cleanup completed');
      }
    });
  }

  /**
   * Toggle auto-save setting
   */
  private static toggleAutoSave(): void {
    const current = this.configService.get<boolean>('general.autoSave');
    this.configService.set('general.autoSave', !current);
    vscode.window.showInformationMessage(`Auto-save ${!current ? 'enabled' : 'disabled'}`);
  }

  /**
   * Toggle progress notifications
   */
  private static toggleProgress(): void {
    const current = this.configService.get<boolean>('general.showProgress');
    this.configService.set('general.showProgress', !current);
    vscode.window.showInformationMessage(`Progress notifications ${!current ? 'enabled' : 'disabled'}`);
  }

  /**
   * Set maximum nodes per flowchart
   */
  private static async setMaxNodes(): Promise<void> {
    const current = this.configService.get<number>('performance.maxNodes');
    const input = await vscode.window.showInputBox({
      prompt: 'Enter maximum number of nodes per flowchart',
      value: current.toString(),
      validateInput: (value) => {
        const num = parseInt(value);
        if (isNaN(num) || num < 10 || num > 1000) {
          return 'Please enter a number between 10 and 1000';
        }
        return null;
      }
    });

    if (input) {
      this.configService.set('performance.maxNodes', parseInt(input));
      vscode.window.showInformationMessage(`Maximum nodes set to ${input}`);
    }
  }

  /**
   * Set maximum file size
   */
  private static async setMaxFileSize(): Promise<void> {
    const current = this.configService.get<number>('performance.maxFileSize');
    const input = await vscode.window.showInputBox({
      prompt: 'Enter maximum file size in KB',
      value: current.toString(),
      validateInput: (value) => {
        const num = parseInt(value);
        if (isNaN(num) || num < 100 || num > 10000) {
          return 'Please enter a number between 100 and 10000 KB';
        }
        return null;
      }
    });

    if (input) {
      this.configService.set('performance.maxFileSize', parseInt(input));
      vscode.window.showInformationMessage(`Maximum file size set to ${input} KB`);
    }
  }
}
