import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { WebviewMessageHandler } from './messageHandler';

export class WebviewManager {
  private context: vscode.ExtensionContext;
  private messageHandler: WebviewMessageHandler;
  private originalFilePath: string | undefined;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.messageHandler = new WebviewMessageHandler();
  }

  /**
   * Create a new flowchart webview panel
   */
  createFlowchartWebview(
    mermaidCode: string, 
    metadata: any, 
    fileName: string,
    originalFilePath?: string,
    whitelistService?: any
  ): vscode.WebviewPanel {
    // Store the original file path for regeneration
    this.originalFilePath = originalFilePath || 
      vscode.window.activeTextEditor?.document.fileName;
    
    // Create the panel
    const panel = vscode.window.createWebviewPanel(
      'pythonFlowchart',
      `Flowchart: ${fileName}`,
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          this.context.extensionUri
        ]
      }
    );

    // Get the webview HTML content
    const htmlUri = vscode.Uri.joinPath(this.context.extensionUri, 'webview', 'index.html');
    let htmlContent = '';

    try {
      htmlContent = fs.readFileSync(htmlUri.fsPath, 'utf-8');
    } catch (e) {
      vscode.window.showErrorMessage('Failed to load webview.html');
      console.error(e);
      throw e;
    }

    // Clean the diagram for postMessage
    const cleanDiagram = this.cleanMermaidCode(mermaidCode);

    // Replace resource placeholders with actual URIs
    htmlContent = this.replaceResourcePlaceholders(htmlContent, panel.webview, cleanDiagram);

    // Set the webview HTML
    panel.webview.html = htmlContent;

    // Set up message handling
    this.messageHandler.setupMessageHandling(panel, this.originalFilePath, this.context, whitelistService);

    // Send initial diagram and state
    if (mermaidCode) {
      // Get current state from whitelistService if available
      let currentWhitelist: string[] = [];
      let forceCollapseList: string[] = [];

      if (whitelistService) {
        currentWhitelist = whitelistService.getWhitelist();
        forceCollapseList = whitelistService.getForceCollapseList();
      }

      panel.webview.postMessage({
        command: 'updateFlowchart',
        diagram: mermaidCode,
        metadata: metadata,
        whitelist: currentWhitelist,
        forceCollapse: forceCollapseList
      });
    }

    return panel;
  }

  /**
   * Clean and normalize Mermaid diagram code
   */
  private cleanMermaidCode(mermaidCode: string): string {
    return mermaidCode
      .replace(/\r\n/g, '\n')  // Normalize line endings
      .replace(/\r/g, '\n')    // Handle any remaining carriage returns
      .trim();                 // Remove extra whitespace
  }

  /**
   * Replace resource placeholders with actual webview URIs
   */
  private replaceResourcePlaceholders(htmlContent: string, webview: vscode.Webview, cleanDiagram: string): string {
    // Format the file path to show parent/filename.py
    const filePath = this.originalFilePath || '';
    const formattedFilePath = filePath ? this.formatFilePath(filePath) : '';
    
    // Don't escape the diagram - let Mermaid handle it naturally
    // The Python code already sanitizes problematic characters
    const escapedDiagram = cleanDiagram;
    
    const replacements: Record<string, string> = {
      '<!-- DIAGRAM_PLACEHOLDER -->': escapedDiagram,
      '{{filePath}}': formattedFilePath,
      '{{stylesUri}}': webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'webview', 'styles.css')).toString(),
      '{{mermaidInitUri}}': webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'webview', 'mermaid-init.js')).toString(),
      '{{zoomPanUri}}': webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'webview', 'zoom-pan.js')).toString(),
      '{{controlsUri}}': webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'webview', 'controls.js')).toString(),
      '{{expandUri}}': webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'webview', 'expand.js')).toString(),
      '{{exportUri}}': webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'webview', 'export.js')).toString(),
      '{{messageHandlerUri}}': webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'webview', 'message-handler.js')).toString(),
      '{{mainUri}}': webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'webview', 'main.js')).toString(),
    };
    
    let result = htmlContent;
    for (const [placeholder, uri] of Object.entries(replacements)) {
      result = result.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), uri);
    }
    
    return result;
  }

  /**
   * Format file path to show parent/filename.py format
   */
  private formatFilePath(filePath: string): string {
    const pathParts = filePath.split(path.sep);
    if (pathParts.length >= 2) {
      const parent = pathParts[pathParts.length - 2];
      const filename = pathParts[pathParts.length - 1];
      return `${parent}/${filename}`;
    }
    return path.basename(filePath);
  }

  /**
   * Generate debug HTML that can be opened directly in a browser
   */
  private generateDebugHtml(
    htmlContent: string, 
    diagram: string, 
    metadata: any, 
    htmlUri: vscode.Uri
  ): void {
    try {
      const debugHtmlContent = this.injectDebugDataIntoHtml(htmlContent, diagram, metadata);
      const debugHtmlPath = path.join(path.dirname(htmlUri.fsPath), 'webview_debug.html');
      fs.writeFileSync(debugHtmlPath, debugHtmlContent, 'utf-8');
      vscode.window.showInformationMessage(`Debug HTML saved to: ${debugHtmlPath}`);
    } catch (e) {
      console.error('Failed to create debug HTML:', e);
    }
  }

  /**
   * Inject debug data into HTML for browser testing
   */
  private injectDebugDataIntoHtml(template: string, diagram: string, metadata: any): string {
    const payload = { type: 'init', diagram, metadata };
    const initScript = `\n<script>\nwindow.addEventListener('DOMContentLoaded', function(){\n  try {\n    window.postMessage(${JSON.stringify(payload)}, '*');\n  } catch(e) { console.error('Failed to inject init data', e); }\n});\n</script>\n`;
    const closing = '</body>';
    
    if (template.includes(closing)) {
      return template.replace(closing, initScript + closing);
    }
    return template + initScript;
  }

  }
