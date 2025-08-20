// --- extension.ts ---

import * as vscode from 'vscode';
import { GenerateFlowchartCommand } from './commands/generateFlowchart';
import { ConfigCommands } from './commands/configCommands';
import { EXTENSION_ID, COMMAND_TITLE, COMMAND_CATEGORY } from './utils/helpers';
import * as path from 'path';
import * as fs from 'fs';

export function activate(context: vscode.ExtensionContext) {
  console.log('Flowchart Machine extension is now active!');
  console.log('Extension context:', context.extensionPath);

  try {
    // Register the generate flowchart command
    const flowchartDisposable = GenerateFlowchartCommand.register(context);
    context.subscriptions.push(flowchartDisposable);
    
    // Register only the essential configuration command (open settings)
    const openSettingsDisposable = vscode.commands.registerCommand('flowchartMachine.config.openSettings', () => {
      vscode.commands.executeCommand('workbench.action.openSettings', 'flowchartMachine');
    });
    context.subscriptions.push(openSettingsDisposable);
    
    // Register command to open saved flowcharts folder
    const openSavedFlowchartsDisposable = vscode.commands.registerCommand('flowchartMachine.openSavedFlowcharts', () => {
      const storagePath = path.join(context.globalStorageUri.fsPath, 'saved-flowcharts');
      if (fs.existsSync(storagePath)) {
        vscode.env.openExternal(vscode.Uri.file(storagePath));
      } else {
        vscode.window.showInformationMessage('No saved flowcharts folder found. Save a diagram first.');
      }
    });
    context.subscriptions.push(openSavedFlowchartsDisposable);

    // Test if the commands are available
    vscode.commands.getCommands().then(commands => {
      const flowchartCommands = commands.filter(cmd => cmd.includes('flowchart'));
      console.log('Available flowchart commands:', flowchartCommands);
      
      const configCommands = commands.filter(cmd => cmd.includes('flowchartMachine'));
      console.log('Available configuration commands:', configCommands);
    });

  } catch (error) {
    console.error('Failed to register commands:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Failed to register ${COMMAND_TITLE} commands: ${errorMessage}`);
  }
}

export function deactivate() {
  console.log('Flowchart Machine extension is now deactivated!');
}