import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export interface FlowchartOutput {
  mermaidCode: string;
  tooltipData: any;
}

export class FileService {
  /**
   * Validate that a file is a Python file
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
   * Get the path to the main.py script in the same directory as the Python file
   */
  static getMainScriptPath(pythonFilePath: string): string {
    const dirPath = this.getDirectoryPath(pythonFilePath);
    return path.join(dirPath, 'main.py');
  }

  /**
   * Get the path to the flowchart output file
   */
  static getFlowchartPath(pythonFilePath: string): string {
    const dirPath = this.getDirectoryPath(pythonFilePath);
    return path.join(dirPath, 'flowchart.mmd');
  }

  /**
   * Get the path to the tooltip data file
   */
  static getTooltipDataPath(pythonFilePath: string): string {
    const dirPath = this.getDirectoryPath(pythonFilePath);
    return path.join(dirPath, 'tooltip_data.json');
  }

  /**
   * Read and process flowchart output files
   */
  static readFlowchartOutput(pythonFilePath: string): FlowchartOutput {
    const flowPath = this.getFlowchartPath(pythonFilePath);
    const tooltipDataPath = this.getTooltipDataPath(pythonFilePath);

    // Read flowchart content
    if (!this.fileExists(flowPath)) {
      throw new Error(`Flowchart file not found at: ${flowPath}`);
    }

    const mermaidCode = this.readFile(flowPath);
    console.log('Mermaid code:', mermaidCode);

    // Read tooltip data
    let tooltipData = {};
    if (this.fileExists(tooltipDataPath)) {
      try {
        tooltipData = JSON.parse(this.readFile(tooltipDataPath));
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
