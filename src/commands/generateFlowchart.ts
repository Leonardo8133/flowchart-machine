import * as vscode from 'vscode';
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

    let entryType: 'file' | 'function' | 'class' | undefined;
    let entryName: string | undefined;

    if (fromContextMenu) {
      // Auto-detect from cursor without prompting
      const detected = this.detectEntryFromCursor(editor);
      entryType = detected.type;
      entryName = detected.name;
    } else {
        entryType = 'file';
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
          MERGE_COMMON_NODES: mergeCommonNodes ? '1' : '0'
        } as Record<string, string>;

        // Pass entry selection to Python
        env.ENTRY_TYPE = entryType || '';
        if (entryName) {
          env.ENTRY_NAME = entryName;
          // Calculate line offset for function/class entries
          if (entryType === 'function' || entryType === 'class') {
            const lineOffset = this.getLineOffsetForEntry(editor, entryType, entryName);
            env.ENTRY_LINE_OFFSET = lineOffset.toString();
          }
        }

        // Get breakpoints for the current file
        const breakpoints = vscode.debug.breakpoints.filter(bp =>
          (bp as any).location?.uri?.fsPath === filePath
        );
        const breakpointLines = breakpoints.map(bp => (bp as any).location?.range?.start?.line + 1).filter(line => line);
        // Add breakpoint info to environment variables
        (env as any).BREAKPOINT_LINES = breakpointLines.join(',');
        (env as any).HAS_BREAKPOINTS = breakpointLines.length > 0 ? '1' : '0';

        console.log('Environment variables being passed to Python:', env);

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

          const whitelistService = new WhitelistService(this.createFileKey(filePath));
          whitelistService.startSession();

          // Create the webview panel
          this.webviewManager.createFlowchartWebview(
            output.mermaidCode,
            output.metadata,
            FileService.getBaseName(filePath),
            filePath,
            whitelistService,
            null // processor is not available in TypeScript
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

  /** Auto-detect entry from cursor.
   *  - If cursor on class or __init__, return class
   *  - If cursor in function, return function
   *  - Else file
   */
  private detectEntryFromCursor(editor: vscode.TextEditor): { type: 'file' | 'function' | 'class', name?: string } {
    const className = this.getSymbolAtCursor(editor, 'class');
    if (className) {
      return { type: 'class', name: className };
    }
    const funcName = this.getSymbolAtCursor(editor, 'function');
    if (funcName) {
      if (funcName === '__init__') {
        // Try to grab enclosing class name
        const enclosingClass = this.getEnclosingClass(editor);
        if (enclosingClass) {
          return { type: 'class', name: enclosingClass };
        }
      }
      return { type: 'function', name: funcName };
    }
    return { type: 'file' };
  }

  private getEnclosingClass(editor: vscode.TextEditor): string | undefined {
    const doc = editor.document;
    const pos = editor.selection.active;
    const text = doc.getText(new vscode.Range(0, 0, pos.line, pos.character));
    const classRegex = /\bclass\s+([A-Za-z_][A-Za-z0-9_]*)\s*(\(|:)\s*$/m;
    const all = text.match(new RegExp("class\\s+([A-Za-z_][A-Za-z0-9_]*)", 'g'));
    // Simple backward scan: iterate lines up
    for (let line = pos.line; line >= 0; line--) {
      const t = doc.lineAt(line).text;
      const m = t.match(/\bclass\s+([A-Za-z_][A-Za-z0-9_]*)\s*(\(|:)/);
      if (m) return m[1];
    }
    return undefined;
  }

  private createFileKey(filePath: string): string {
    const path = require('path');
    const parentDir = path.basename(path.dirname(filePath));
    const fileName = path.basename(filePath, path.extname(filePath));
    return `(${parentDir})/(${fileName})`;
  }

  /**
   * Get the line offset for a function or class entry
   */
  private getLineOffsetForEntry(editor: vscode.TextEditor, entryType: 'function' | 'class', entryName: string): number {
    const document = editor.document;
    
    for (let i = 0; i < document.lineCount; i++) {
      const line = document.lineAt(i);
      const lineText = line.text;
      
      if (entryType === 'function' && lineText.includes(`def ${entryName}(`)) {
        return i; // Return 0-based line number
      }
      
      if (entryType === 'class' && lineText.includes(`class ${entryName}(`)) {
        return i; // Return 0-based line number
      }
    }
    
    return 0; // Fallback to 0 if not found
  }
}
