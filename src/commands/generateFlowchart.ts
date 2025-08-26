import * as vscode from 'vscode';
import { PythonService } from '../services/pythonService';
import { FileService } from '../services/fileService';
import { WebviewManager } from '../webview/webviewManager';

export class GenerateFlowchartCommand {
  private context: vscode.ExtensionContext;
  private webviewManager: WebviewManager;
  private fileService: FileService;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.webviewManager = new WebviewManager(context);
    this.fileService = new FileService(context);
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
    const scriptPath = this.fileService.getMainScriptPath();
    if (!FileService.fileExists(scriptPath)) {
      vscode.window.showErrorMessage(
        `Python script not found at: ${scriptPath}. Please ensure main.py exists in the extension's flowchart directory.`
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

      return new Promise<void>(async (resolve, reject) => {
        // Read configuration for node processing types
        const config = vscode.workspace.getConfiguration('flowchartMachine');
        const showPrints = config.get('nodes.processTypes.prints', true);
        const detailFunctions = config.get('nodes.processTypes.functions', true);
        const forLoops = config.get('nodes.processTypes.forLoops', true);
        const whileLoops = config.get('nodes.processTypes.whileLoops', true);
        const variables = config.get('nodes.processTypes.variables', true);
        const ifs = config.get('nodes.processTypes.ifs', true);
        const imports = config.get('nodes.processTypes.imports', true);
        const exceptions = config.get('nodes.processTypes.exceptions', true);
        const returns = config.get('nodes.processTypes.returns', true);

        // Set environment variables for Python script
        const env = {
          ...process.env,
          SHOW_PRINTS: showPrints ? '1' : '0',
          DETAIL_FUNCTIONS: detailFunctions ? '1' : '0',
          SHOW_FOR_LOOPS: forLoops ? '1' : '0',
          SHOW_WHILE_LOOPS: whileLoops ? '1' : '0',
          SHOW_VARIABLES: variables ? '1' : '0',
          SHOW_IFS: ifs ? '1' : '0',
          SHOW_IMPORTS: imports ? '1' : '0',
          SHOW_EXCEPTIONS: exceptions ? '1' : '0',
          SHOW_RETURNS: returns ? '1' : '0'
        };

        // Get breakpoints for the current file
        const breakpoints = vscode.debug.breakpoints.filter(bp =>
          (bp as any).location?.uri?.fsPath === filePath
        );
        const breakpointLines = breakpoints.map(bp => (bp as any).location?.range?.start?.line + 1).filter(line => line);
        // Add breakpoint info to environment variables
        (env as any).BREAKPOINT_LINES = breakpointLines.join(',');
        (env as any).HAS_BREAKPOINTS = breakpointLines.length > 0 ? '1' : '0';

        const result = await PythonService.executeScript(scriptPath, [filePath], env);

        if (!result.success) {
          vscode.window.showErrorMessage("Error generating flowchart. See console for details.");
          console.error(`Python execution error: ${result.error}`);
          console.error(`stderr: ${result.stderr}`);
          reject(new Error(result.error));
          return;
        }
        // Show all logging and prints executed by the .py file
        if (result.stdout || result.stderr) {
          const outputChannel = vscode.window.createOutputChannel('Flowchart Machine - Python Output');
          outputChannel.show();

          if (result.stdout) {
            outputChannel.appendLine('=== Python Script Output ===');
            outputChannel.appendLine(result.stdout);
          }

          if (result.stderr) {
            outputChannel.appendLine('=== Python Script Errors ===');
            outputChannel.appendLine(result.stderr);
          }

          outputChannel.appendLine('=== End Python Output ===\n');
        }

        progress.report({ increment: 50 });

        try {
          // Read the output files
          const output = this.fileService.readFlowchartOutput(filePath);
          progress.report({ increment: 100 });

          console.log("cleanDiagram GENERATE", output.mermaidCode);

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
