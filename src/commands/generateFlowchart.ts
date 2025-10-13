import * as vscode from 'vscode';
import * as path from 'path';
import { PythonService } from '../services/pythonService';
import { FileService } from '../services/fileService';
import { WebviewManager } from '../webview/webviewManager';
import { WhitelistService } from '../services/whitelistService';

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
  async execute(fromContextMenu: boolean = false): Promise<void> {

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

    let entryType: 'file' | 'function' | 'class' | undefined;
    let entryClass: string | undefined;
    let entryName: string | undefined;

    if (fromContextMenu) {
      // Auto-detect from cursor without prompting
      const detected = this.detectEntryFromCursor(editor);
      entryType = detected.type;
      entryClass = detected.class;
      entryName = detected.name;

      // OUTPUT THE DETECTED ENTRY
      const outputChannel = vscode.window.createOutputChannel('Flowchart Debug');
      outputChannel.show();
      outputChannel.appendLine(`Detected entry: ${JSON.stringify(detected, null, 2)}`);


    } else {
        entryType = 'file';
        entryClass = undefined;
        entryName = undefined;
    }

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
        const classes = config.get('nodes.processTypes.classes', true);
        const mergeCommonNodes = config.get('nodes.processTypes.mergeCommonNodes', true);
        const callerDepth = config.get('connectionView.inboundDepth', 3);
        const calleeDepth = config.get('connectionView.outboundDepth', 4);

        // Set environment variables for Python script
        const env = {
          ...process.env,
          SHOW_PRINTS: showPrints ? '1' : '0',
          SHOW_FUNCTIONS: detailFunctions ? '1' : '0',
          SHOW_FOR_LOOPS: forLoops ? '1' : '0',
          SHOW_WHILE_LOOPS: whileLoops ? '1' : '0',
          SHOW_VARIABLES: variables ? '1' : '0',
          SHOW_IFS: ifs ? '1' : '0',
          SHOW_IMPORTS: imports ? '1' : '0',
          SHOW_EXCEPTIONS: exceptions ? '1' : '0',
          SHOW_RETURNS: returns ? '1' : '0',
          SHOW_CLASSES: classes ? '1' : '0',
          MERGE_COMMON_NODES: mergeCommonNodes ? '1' : '0',
          CONNECTION_CALLER_DEPTH: `${callerDepth}`,
          CONNECTION_CALLEE_DEPTH: `${calleeDepth}`
        } as Record<string, string>;

        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || path.dirname(filePath);
        env.WORKSPACE_ROOT = workspaceRoot;

        // Pass entry selection to Python
        env.ENTRY_TYPE = entryType || 'file';
        env.ENTRY_CLASS = entryClass || '';
        env.ENTRY_NAME = entryName || '';
        
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
          let connectionDiagram: string | null = null;
          let connectionMetadata: any = null;

          const connectionScriptPath = this.fileService.getConnectionScriptPath();
          if (entryType !== 'file' && FileService.fileExists(connectionScriptPath)) {
            try {
              const connectionEnv = { ...env };
              const connectionResult = await PythonService.executeScript(connectionScriptPath, [filePath], connectionEnv);
              if (connectionResult.success) {
                const connectionOutput = this.fileService.readConnectionViewOutput();
                if (connectionOutput) {
                  connectionDiagram = connectionOutput.mermaidCode;
                  connectionMetadata = connectionOutput.metadata;
                }
              } else {
                console.warn('Connection view generation failed:', connectionResult.error);
              }
            } catch (connectionError) {
              console.warn('Connection view script error:', connectionError);
            }
          }
          progress.report({ increment: 100 });

          const whitelistService = new WhitelistService(this.createFileKey(filePath));
          whitelistService.startSession();

          // Create the webview panel
          this.webviewManager.createFlowchartWebview(
            output.mermaidCode,
            output.metadata,
            FileService.getBaseName(filePath),
            filePath,
            whitelistService,
            null, // processor is not available in TypeScript
            connectionDiagram,
            connectionMetadata
          );
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  /**
   * Command entry to trigger regeneration programmatically (used by tests).
   */
  async triggerRegeneration(): Promise<void> {
    await this.webviewManager.triggerRegeneration();
  }

  /**
   * Get the function or class name at current cursor position.
   */
  private getSymbolAtCursor(editor: vscode.TextEditor, type: 'function' | 'class'): string | undefined {
    const position = editor.selection.active;
    const document = editor.document;
    const cursorLine = position.line;

    const funcRegex = /\bdef\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;
    const classRegex = /\bclass\s+([A-Za-z_][A-Za-z0-9_]*)\s*(\(|:)/g;
    
    let match: RegExpExecArray | null;

    const search = (regex: RegExp) => {
      // Reset regex lastIndex to ensure we search from the beginning
      regex.lastIndex = 0;
      
      while ((match = regex.exec(document.getText()))) {
        const start = match.index;
        const name = match[1];
        const defLine = document.positionAt(start).line;
        
        // Find the end of this function/class by looking at indentation
        const defLineText = document.lineAt(defLine).text;
        const defIndent = defLineText.match(/^(\s*)/)?.[1].length || 0;
        
        // Find the next line with same or less indentation (function end)
        let endLine = defLine + 1;
        while (endLine < document.lineCount) {
          const lineText = document.lineAt(endLine).text;
          const lineIndent = lineText.match(/^(\s*)/)?.[1].length || 0;
          
          // If line is empty, continue
          if (lineText.trim() === '') {
            endLine++;
            continue;
          }
          
          // If indentation is same or less than def line, function has ended
          if (lineIndent <= defIndent) {
            break;
          }
          endLine++;
        }
        
        // Check if cursor is inside this function/class
        if (cursorLine >= defLine && cursorLine < endLine) {
          return name;
        }
      }
      return undefined;
    };

    if (type === 'function') {
      return search(funcRegex);
    }
    return search(classRegex);
  }

  /**
   * Register the command with VS Code
   */
  static register(context: vscode.ExtensionContext): vscode.Disposable {
    const command = new GenerateFlowchartCommand(context);
    const d1 = vscode.commands.registerCommand('extension.generateFlowchart', () => command.execute(false));
    const d2 = vscode.commands.registerCommand('extension.generateFlowchartAtCursor', () => command.execute(true));
    const d3 = vscode.commands.registerCommand('extension.triggerRegeneration', () => command.triggerRegeneration());
    return { dispose: () => { d1.dispose(); d2.dispose(); d3.dispose(); } } as vscode.Disposable;
  }

  private detectEntryFromCursor(editor: vscode.TextEditor): { type: 'file' | 'function' | 'class', name?: string, class?: string } {
    const className = this.getSymbolAtCursor(editor, 'class');
    const funcName = this.getSymbolAtCursor(editor, 'function');
    
    if (className) {
      // We're inside a class
      if (funcName) {
        // We're in a method within the class
        return { type: 'class', name: funcName, class: className };
      } else {
        // We're on the class definition itself (not inside any method)
        return { type: 'class', name: "__init__", class: className };
      }
    }
    
    if (funcName) {
      return { type: 'function', name: funcName };
    }
    return { type: 'file' };
  }

  private createFileKey(filePath: string): string {
    const path = require('path');
    const parentDir = path.basename(path.dirname(filePath));
    const fileName = path.basename(filePath, path.extname(filePath));
    return `(${parentDir})/(${fileName})`;
  }

}
