// --- extension.ts ---

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand('extension.generateFlowchart', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage("No active editor.");
      return;
    }
    if (editor.document.isDirty) {
      await editor.document.save();
    }
    const filePath = editor.document.fileName;
    // Assuming the python script is in the same directory as the source file.
    // In a real extension, you would bundle this script.
    const scriptPath = path.join(path.dirname(filePath), 'main.py');

    exec(`python "${scriptPath}" "${filePath}"`, (error, stdout, stderr) => {
      if (error) {
        vscode.window.showErrorMessage("Error generating flowchart. See console for details.");
        console.error(`exec error: ${error}`);
        console.error(`stderr: ${stderr}`);
        return;
      }
      
      console.log(`Python script output: ${stdout}`);

      const dirPath = path.dirname(filePath);
      const flowPath = path.join(dirPath, "flowchart.mmd");
      const tooltipDataPath = path.join(dirPath, "tooltip_data.json");

      if (!fs.existsSync(flowPath)) {
        vscode.window.showErrorMessage(`Flowchart file not found at: ${flowPath}`);
        return;
      }
      const mermaidCode = fs.readFileSync(flowPath, 'utf-8');
      
      let tooltipData = {};
      if (fs.existsSync(tooltipDataPath)) {
        try {
            tooltipData = JSON.parse(fs.readFileSync(tooltipDataPath, 'utf-8'));
        } catch(e) {
            vscode.window.showErrorMessage("Error parsing tooltip_data.json.");
            console.error(e);
        }
      }

      // --- FIX: Generate the HTML content first ---
      const webviewHtml = getWebviewHtml(mermaidCode, tooltipData);

      // --- FIX: Define the path for the debug HTML file and save it ---
      const debugHtmlPath = path.join(dirPath, "webview_debug.html");
      fs.writeFileSync(debugHtmlPath, webviewHtml, 'utf-8');
      vscode.window.showInformationMessage(`Debug HTML saved to: ${debugHtmlPath}`);

      // Now create the panel and set its HTML
      const panel = vscode.window.createWebviewPanel(
        'pythonFlowchart',
        `Flowchart: ${path.basename(filePath)}`,
        vscode.ViewColumn.Beside,
        { enableScripts: true }
      );
      panel.webview.html = webviewHtml;
    });
  });

  context.subscriptions.push(disposable);
}

function getWebviewHtml(diagram: string, tooltipData: object): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Python Flowchart</title>
          <style>
              /* --- FIX 1: Updated CSS for a solid, stationary tooltip --- */
              body, html { 
                  margin: 0; 
                  padding: 10px; 
                  height: 100%; 
                  background-color: var(--vscode-editor-background); 
                  cursor: default; 
              }
              .mermaid .clickable { 
                  cursor: pointer; 
              }
              #tooltip {
                  position: fixed; /* Use fixed positioning */
                  display: none;
                  padding: 10px 15px;
                  /* Use a solid, opaque background from the VS Code theme */
                  background-color: var(--vscode-side-bar-background, #252526);
                  border: 1px solid var(--vscode-widget-border, #303030);
                  border-radius: 6px;
                  font-family: var(--vscode-font-family);
                  font-size: var(--vscode-font-size);
                  color: var(--vscode-editor-foreground);
                  z-index: 100;
                  max-width: 400px;
                  /* Add a shadow to make it pop */
                  box-shadow: 0 5px 15px rgba(0,0,0,0.3);
              }
              #tooltip h4 { margin-top: 0; border-bottom: 1px solid var(--vscode-foreground); padding-bottom: 4px; }
              #tooltip p { margin-bottom: 0; }
          </style>
      </head>
      <body>
          <div id="tooltip"></div>
          <div class="mermaid">
            ${diagram}
          </div>
          
          <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
          <script>
              // --- FIX 2: New JavaScript logic for stationary tooltips ---

              const tooltipData = ${JSON.stringify(tooltipData)};
              const tooltipDiv = document.getElementById('tooltip');
              let lastClickedNodeId = null;

              // This function is called by Mermaid. It ONLY stores the ID.
              window.setClickedNode = function(nodeId) {
                lastClickedNodeId = nodeId;
              };

              // This general event listener handles the logic of showing/hiding the tooltip.
              document.addEventListener('click', function(e) {
                const clickedElement = e.target.closest('.clickable');

                if (clickedElement && lastClickedNodeId) {
                    // --- A flowchart node was clicked ---
                    const content = tooltipData[lastClickedNodeId];
                    if (content) {
                        tooltipDiv.innerHTML = content;
                        
                        // Get the position of the clicked node
                        const rect = clickedElement.getBoundingClientRect();
                        
                        // Position the tooltip to the right of the node
                        tooltipDiv.style.left = (rect.right + 10) + 'px';
                        tooltipDiv.style.top = rect.top + 'px';

                        tooltipDiv.style.display = 'block';
                    }
                    // Reset for the next click
                    lastClickedNodeId = null;
                } else {
                    // --- Clicked outside a node, so hide the tooltip ---
                    tooltipDiv.style.display = 'none';
                }
              }, true);

              // Initialize Mermaid with the required security level
              mermaid.initialize({
                  startOnLoad: true,
                  theme: document.body.classList.contains('vscode-dark') ? 'dark' : 'default',
                  flowchart: { useMaxWidth: true, htmlLabels: true },
                  securityLevel: 'loose' 
              });
          </script>
      </body>
      </html>`;
}