// --- extension.ts ---

import * as vscode from 'vscode';
import { GenerateFlowchartCommand } from './commands/generateFlowchart';
import { ConfigCommands } from './commands/configCommands';
import { EXTENSION_ID, COMMAND_TITLE, COMMAND_CATEGORY } from './utils/helpers';

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
    
    console.log('Commands registered successfully:', EXTENSION_ID);

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