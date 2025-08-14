import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { WebviewMessageHandler } from './messageHandler';

export class WebviewManager {
  private context: vscode.ExtensionContext;
  private messageHandler: WebviewMessageHandler;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.messageHandler = new WebviewMessageHandler();
  }

  /**
   * Create a new flowchart webview panel
   */
  createFlowchartWebview(
    mermaidCode: string, 
    tooltipData: any, 
    fileName: string,
    originalFilePath?: string
  ): vscode.WebviewPanel {
    // Store the original file path for regeneration
    const originalFilePathToStore = originalFilePath || 
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
    const htmlUri = vscode.Uri.joinPath(this.context.extensionUri, 'webview.html');
    let htmlContent = '';

    try {
      htmlContent = fs.readFileSync(htmlUri.fsPath, 'utf-8');
    } catch (e) {
      vscode.window.showErrorMessage('Failed to load webview.html');
      console.error(e);
      throw e;
    }

    // Clean the diagram before injecting
    const cleanDiagram = this.cleanMermaidCode(mermaidCode);

    // Inject the diagram directly into the HTML
    htmlContent = htmlContent.replace(
      '<!-- DIAGRAM_PLACEHOLDER (diagram arrives via postMessage) -->',
      cleanDiagram
    );

    // Convert local resource URIs to webview URIs
    htmlContent = this.convertResourceUris(htmlContent, panel.webview, htmlUri);

    // Set the webview HTML
    panel.webview.html = htmlContent;

    // Set up message handling
    this.messageHandler.setupMessageHandling(panel, originalFilePathToStore);

    // Generate debug HTML
    this.generateDebugHtml(htmlContent, cleanDiagram, tooltipData, htmlUri);

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
   * Convert local resource URIs to webview URIs
   */
  private convertResourceUris(
    htmlContent: string, 
    webview: vscode.Webview, 
    htmlUri: vscode.Uri
  ): string {
    return htmlContent.replace(
      /(src|href)=(["'])(.*?)\2/gi,
      (match, attr, quote, url) => {
        if (url.startsWith('http') || url.startsWith('data:')) {
          return match; // Keep external URLs unchanged
        }
        // Convert local paths to webview URIs
        const localUri = vscode.Uri.joinPath(this.context.extensionUri, url);
        const webviewLocalUri = webview.asWebviewUri(localUri);
        return `${attr}=${quote}${webviewLocalUri}${quote}`;
      }
    );
  }

  /**
   * Generate debug HTML that can be opened directly in a browser
   */
  private generateDebugHtml(
    htmlContent: string, 
    diagram: string, 
    tooltipData: any, 
    htmlUri: vscode.Uri
  ): void {
    try {
      const debugHtmlContent = this.injectDebugDataIntoHtml(htmlContent, diagram, tooltipData);
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
  private injectDebugDataIntoHtml(template: string, diagram: string, tooltipData: any): string {
    const payload = { type: 'init', diagram, tooltipData };
    const initScript = `\n<script>\nwindow.addEventListener('DOMContentLoaded', function(){\n  try {\n    window.postMessage(${JSON.stringify(payload)}, '*');\n  } catch(e) { console.error('Failed to inject init data', e); }\n});\n</script>\n`;
    const closing = '</body>';
    
    if (template.includes(closing)) {
      return template.replace(closing, initScript + closing);
    }
    return template + initScript;
  }
}
