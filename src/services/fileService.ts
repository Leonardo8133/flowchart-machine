import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export interface FlowchartOutput {
  mermaidCode: string;
  tooltipData: any;
}

export class FileService {
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  /**
   * Check if a document is a Python file
   */
  static isPythonFile(document: vscode.TextDocument): boolean {
    return document.languageId === 'python';
  }

  /**
   * Get the directory path of a file
   */
  static getDirectoryPath(filePath: string): string {
    return path.dirname(filePath);
  }

  /**
   * Get the filename without extension
   */
  static getBaseName(filePath: string): string {
    return path.basename(filePath);
  }

  /**
   * Check if a file exists
   */
  static fileExists(filePath: string): boolean {
    return fs.existsSync(filePath);
  }

  /**
   * Read file content as string
   */
  static readFile(filePath: string, encoding: BufferEncoding = 'utf-8'): string {
    return fs.readFileSync(filePath, encoding);
  }

  /**
   * Get the path to the main.py script in the extension's directory
   */
  getMainScriptPath(): string {
    return path.join(this.context.extensionPath, 'flowchart', 'main.py');
  }

  /**
   * Get the path to the flowchart output file in the temp folder
   */
  getFlowchartPath(pythonFilePath: string): string {
    const extensionPath = this.context.extensionPath;
    return path.join(extensionPath, 'flowchart', 'temp', 'flowchart.mmd');
  }

  /**
   * Get the path to the tooltip data file in the temp folder
   */
  getTooltipDataPath(pythonFilePath: string): string {
    const extensionPath = this.context.extensionPath;
    return path.join(extensionPath, 'flowchart', 'temp', 'tooltip_data.json');
  }

  /**
   * Read and process flowchart output files
   */
  readFlowchartOutput(pythonFilePath: string): FlowchartOutput {
    const flowPath = this.getFlowchartPath(pythonFilePath);
    const tooltipDataPath = this.getTooltipDataPath(pythonFilePath);

    // Read flowchart content
    if (!FileService.fileExists(flowPath)) {
      throw new Error(`Flowchart file not found at: ${flowPath}`);
    }

    const mermaidCode = FileService.readFile(flowPath);

    // Read tooltip data
    let tooltipData = {};
    if (FileService.fileExists(tooltipDataPath)) {
      try {
        tooltipData = JSON.parse(FileService.readFile(tooltipDataPath));
      } catch (e) {
        vscode.window.showWarningMessage("Warning: Error parsing tooltip_data.json.");
        console.error(e);
      }
    }

    return {
      mermaidCode,
      tooltipData
    };
  }

  /**
   * Clean and normalize Mermaid diagram code
   */
  static cleanMermaidCode(code: string): string {
    return code
      .replace(/\r\n/g, '\n')  // Normalize line endings
      .replace(/\r/g, '\n')    // Handle any remaining carriage returns
      .trim();                 // Remove extra whitespace
  }
}
