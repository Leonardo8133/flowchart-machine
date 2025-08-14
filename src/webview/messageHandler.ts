import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { PythonService } from '../services/pythonService';
import { FileService } from '../services/fileService';

export class WebviewMessageHandler {
  private originalFilePath?: string;

  /**
   * Set up message handling for a webview panel
   */
  setupMessageHandling(panel: vscode.WebviewPanel, originalFilePath?: string): void {
    this.originalFilePath = originalFilePath;

    panel.webview.onDidReceiveMessage(
      async (message) => {
        await this.handleMessage(message, panel);
      }
    );
  }

  /**
   * Handle incoming messages from the webview
   */
  private async handleMessage(message: any, panel: vscode.WebviewPanel): Promise<void> {
    switch (message.command) {
      case 'regenerateComplete':
        await this.handleRegeneration(panel);
        break;
      
      default:
        console.log('Unknown message command:', message.command);
        break;
    }
  }

  /**
   * Handle flowchart regeneration request
   */
  private async handleRegeneration(panel: vscode.WebviewPanel): Promise<void> {
    try {
      console.log('Regenerating complete flowchart...');
      
      if (!this.originalFilePath) {
        panel.webview.postMessage({ 
          command: 'regenerationError', 
          error: 'Original file path not found' 
        });
        return;
      }

      // Check if the original file still exists
      if (!FileService.fileExists(this.originalFilePath)) {
        panel.webview.postMessage({ 
          command: 'regenerationError', 
          error: 'Original Python file not found. It may have been moved or deleted.' 
        });
        return;
      }

      const scriptPath = FileService.getMainScriptPath(this.originalFilePath);

      // Check if the Python script still exists
      if (!FileService.fileExists(scriptPath)) {
        panel.webview.postMessage({ 
          command: 'regenerationError', 
          error: 'Python script not found. Please ensure main.py exists in the same directory.' 
        });
        return;
      }

      // Execute the Python script again
      const result = await PythonService.executeScript(scriptPath, [this.originalFilePath]);
      
      if (!result.success) {
        console.error(`Regeneration error: ${result.error}`);
        panel.webview.postMessage({ 
          command: 'regenerationError', 
          error: `Error generating flowchart: ${result.error}` 
        });
        return;
      }

      try {
        // Read the updated files
        const output = FileService.readFlowchartOutput(this.originalFilePath);
        const cleanDiagram = FileService.cleanMermaidCode(output.mermaidCode);

        // Send the updated diagram to the webview
        panel.webview.postMessage({
          command: 'updateFlowchart',
          diagram: cleanDiagram,
          tooltipData: output.tooltipData
        });

        // Update the global tooltip data in the webview
        panel.webview.postMessage({
          command: 'updateTooltipData',
          tooltipData: output.tooltipData
        });

        // Notify completion
        panel.webview.postMessage({ command: 'regenerationComplete' });
        
        console.log('Flowchart regenerated successfully');
      } catch (readError) {
        console.error('Error reading regenerated files:', readError);
        panel.webview.postMessage({ 
          command: 'regenerationError', 
          error: `Error reading regenerated files: ${readError}` 
        });
      }
    } catch (error) {
      console.error('Regeneration failed:', error);
      panel.webview.postMessage({ 
        command: 'regenerationError', 
        error: `Regeneration failed: ${error}` 
      });
    }
  }
}
