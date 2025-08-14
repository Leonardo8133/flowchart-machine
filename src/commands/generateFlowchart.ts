import * as vscode from 'vscode';
import { PythonService } from '../services/pythonService';
import { FileService } from '../services/fileService';
import { WebviewManager } from '../webview/webviewManager';

export class GenerateFlowchartCommand {
  private context: vscode.ExtensionContext;
  private webviewManager: WebviewManager;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.webviewManager = new WebviewManager(context);
  }

  /**
   * Execute the generate flowchart command
   */
  async execute(): Promise<void> {
    console.log('Command executed: extension.generateFlowchart');
    
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage("No active editor.");
      return;
    }

    // Check if it's a Python file
    if (!FileService.isPythonFile(editor.document)) {
      vscode.window.showErrorMessage("This command only works with Python files.");
      return;
    }

    // Save the document if it's dirty
    if (editor.document.isDirty) {
      await editor.document.save();
    }

    const filePath = editor.document.fileName;
    console.log('Processing file:', filePath);

    // Check if Python is available
    const pythonCheck = await PythonService.checkAvailability();
    if (!pythonCheck.available) {
      vscode.window.showErrorMessage(`Python is not available: ${pythonCheck.error}`);
      return;
    }

    // Check if the Python script exists
    const scriptPath = FileService.getMainScriptPath(filePath);
    if (!FileService.fileExists(scriptPath)) {
      vscode.window.showErrorMessage(
        `Python script not found at: ${scriptPath}. Please ensure main.py exists in the same directory as your Python file.`
      );
      return;
    }

    // Show progress
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: "Generating Flowchart...",
      cancellable: false
    }, async (progress) => {
      progress.report({ increment: 0 });

      return new Promise<void>((resolve, reject) => {
        // Execute the Python script
        PythonService.executeScript(scriptPath, [filePath]).then(result => {
          if (!result.success) {
            vscode.window.showErrorMessage("Error generating flowchart. See console for details.");
            console.error(`Python execution error: ${result.error}`);
            console.error(`stderr: ${result.stderr}`);
            reject(new Error(result.error));
            return;
          }

          console.log(`Python script output: ${result.stdout}`);
          progress.report({ increment: 50 });

          try {
            // Read the output files
            const output = FileService.readFlowchartOutput(filePath);
            progress.report({ increment: 100 });

            // Create the webview panel
            this.webviewManager.createFlowchartWebview(
              output.mermaidCode, 
              output.tooltipData, 
              FileService.getBaseName(filePath),
              filePath
            );
            resolve();
          } catch (error) {
            reject(error);
          }
        }).catch(error => {
          reject(error);
        });
      });
    });
  }

  /**
   * Register the command with VS Code
   */
  static register(context: vscode.ExtensionContext): vscode.Disposable {
    const command = new GenerateFlowchartCommand(context);
    return vscode.commands.registerCommand('extension.generateFlowchart', () => {
      return command.execute();
    });
  }
}
