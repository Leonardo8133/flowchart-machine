import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { PythonService } from '../services/pythonService';
import { FileService } from '../services/fileService';
import { ConfigService } from '../services/configService';

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
    console.log('Received message from webview:', message);
    switch (message.command) {
      case 'updateFlowchart':
        await this.handleRegeneration(panel);
        break;
        
      case 'createPng':
        await this.handleCreatePng(message, panel);
        break;
        
      case 'updateConfig':
        await this.handleConfigUpdate(message, panel);
        break;
      
      case 'requestInitialState': {
        const config = vscode.workspace.getConfiguration('flowchartMachine');
        const showPrints = config.get('nodes.processTypes.prints', true);
        const detailFunctions = config.get('nodes.processTypes.functions', true);
        const forLoops = config.get('nodes.processTypes.forLoops', true);
        const whileLoops = config.get('nodes.processTypes.whileLoops', true);
        const variables = config.get('nodes.processTypes.variables', true);
        const ifs = config.get('nodes.processTypes.ifs', true);
        const imports = config.get('nodes.processTypes.imports', true);
        const exceptions = config.get('nodes.processTypes.exceptions', true);
        panel.webview.postMessage({
          command: 'updateInitialState',
          showPrints,
          detailFunctions,
          forLoops,
          whileLoops,
          variables,
          ifs,
          imports,
          exceptions,
        });
        break;
      }
      
      default:
        console.log('Unknown message command:', message.command);
        break;
    }
  }

  /**
   * Get current checkbox states from the webview
   */
  private async getCurrentCheckboxStates(panel: vscode.WebviewPanel): Promise<{ 
    showPrints: boolean; 
    detailFunctions: boolean;
    forLoops: boolean;
    whileLoops: boolean;
    variables: boolean;
    ifs: boolean;
    imports: boolean;
    exceptions: boolean;
  }> {
    try {
      // Request current checkbox states from the webview
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          // Fallback to VS Code config if webview doesn't respond
          const config = vscode.workspace.getConfiguration('flowchartMachine');
          resolve({
            showPrints: config.get('nodes.processTypes.prints', true),
            detailFunctions: config.get('nodes.processTypes.functions', true),
            forLoops: config.get('nodes.processTypes.forLoops', true),
            whileLoops: config.get('nodes.processTypes.whileLoops', true),
            variables: config.get('nodes.processTypes.variables', true),
            ifs: config.get('nodes.processTypes.ifs', true),
            imports: config.get('nodes.processTypes.imports', true),
            exceptions: config.get('nodes.processTypes.exceptions', true)
          });
        }, 1000);

        // Listen for the response
        const messageListener = panel.webview.onDidReceiveMessage((message) => {
          if (message.command === 'checkboxStates') {
            clearTimeout(timeout);
            messageListener.dispose();
            resolve({
              showPrints: message.showPrints ?? true,
              detailFunctions: message.detailFunctions ?? true,
              forLoops: message.forLoops ?? true,
              whileLoops: message.whileLoops ?? true,
              variables: message.variables ?? true,
              ifs: message.ifs ?? true,
              imports: message.imports ?? true,
              exceptions: message.exceptions ?? true
            });
          }
        });

        // Request the states
        panel.webview.postMessage({ command: 'getCheckboxStates' });
      });
    } catch (error) {
      console.error('Failed to get checkbox states, using defaults:', error);
      // Fallback to VS Code config
      const config = vscode.workspace.getConfiguration('flowchartMachine');
      return {
        showPrints: config.get('nodes.processTypes.prints', true),
        detailFunctions: config.get('nodes.processTypes.functions', true),
        forLoops: config.get('nodes.processTypes.forLoops', true),
        whileLoops: config.get('nodes.processTypes.whileLoops', true),
        variables: config.get('nodes.processTypes.variables', true),
        ifs: config.get('nodes.processTypes.ifs', true),
        imports: config.get('nodes.processTypes.imports', true),
        exceptions: config.get('nodes.processTypes.exceptions', true)
      };
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
      const checkboxStates = await this.getCurrentCheckboxStates(panel);
      const env = {
        ...process.env,
        SHOW_PRINTS: checkboxStates.showPrints ? '1' : '0',
        DETAIL_FUNCTIONS: checkboxStates.detailFunctions ? '1' : '0',
        SHOW_FOR_LOOPS: checkboxStates.forLoops ? '1' : '0',
        SHOW_WHILE_LOOPS: checkboxStates.whileLoops ? '1' : '0',
        SHOW_VARIABLES: checkboxStates.variables ? '1' : '0',
        SHOW_IFS: checkboxStates.ifs ? '1' : '0',
        SHOW_IMPORTS: checkboxStates.imports ? '1' : '0',
        SHOW_EXCEPTIONS: checkboxStates.exceptions ? '1' : '0'
      };
      
      const result = await PythonService.executeScript(scriptPath, [this.originalFilePath], env);
      
      // Show Python script output in VS Code output panel
      console.log('Python script has output, creating output panel...');
      const outputChannel = vscode.window.createOutputChannel('Flowchart Machine - Python Output');
      outputChannel.show();
      if (result.stdout || result.stderr) {
        
        if (result.stdout) {
          console.log('Adding stdout to output panel:', result.stdout);
          outputChannel.appendLine('=== Python Script Output ===');
          outputChannel.appendLine(result.stdout);
        }
        
        if (result.stderr) {
          console.log('Adding stderr to output panel:', result.stderr);
          outputChannel.appendLine('=== Python Script Errors ===');
          outputChannel.appendLine(result.stderr);
        }
        
        outputChannel.appendLine('=== End Python Output ===\n');
        console.log('Output panel created and populated');
        
        // Show notification to help user find the output
        vscode.window.showInformationMessage(
          'Python script output available in "Flowchart Machine - Python Output" panel. View → Output → Flowchart Machine - Python Output'
        );
      } else {
        console.log('No Python output to display');
      }
      
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

  /**
   * Handle PNG creation request from webview
   */
  private async handleCreatePng(message: any, panel: vscode.WebviewPanel): Promise<void> {
    try {
      if (message.error) {
        // PNG conversion failed in webview
        panel.webview.postMessage({ 
          command: 'pngResult', 
          success: false, 
          error: message.error 
        });
        return;
      }

      const { pngData } = message;

      if (!this.originalFilePath) {
        throw new Error('Original file path not found');
      }

      // Compute target directory (Downloads by default, fallback to original dir)
      const targetDir = await this.getDefaultDownloadDirectory(path.dirname(this.originalFilePath));
      // Compute versioned filename based on original python file name
      const pythonBase = path.basename(this.originalFilePath, path.extname(this.originalFilePath));
      const filename = await this.getNextVersionedPngFilename(targetDir, pythonBase);

      // Ensure directory exists and save the PNG data to a file
      const fullPath = path.join(targetDir, filename);
      await this.savePngToFile(pngData, fullPath);
      
      // Send success response
      panel.webview.postMessage({ 
        command: 'pngResult', 
        success: true, 
        filename: filename,
        directory: targetDir
      });
      
      vscode.window.showInformationMessage(
        `Flowchart saved as PNG: ${filename} in ${targetDir}`,
        'Open File',
        'Open Folder'
      ).then(selection => {
        if (selection === 'Open File') {
          vscode.commands.executeCommand('vscode.open', vscode.Uri.file(path.join(targetDir, filename)));
        } else if (selection === 'Open Folder') {
          vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(path.join(targetDir, filename)));
        }
      });
      
    } catch (error) {
      console.error('PNG save failed:', error);
      panel.webview.postMessage({ 
        command: 'pngResult', 
        success: false, 
        error: `PNG save failed: ${error}` 
      });
    }
  }

  /**
   * Save PNG data to file
   */
  private async savePngToFile(pngData: string, fullPath: string): Promise<void> {
    try {
      // Remove data URL prefix
      const base64Data = pngData.replace(/^data:image\/png;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      
      // Ensure target directory exists
      await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });

      // Write the PNG file
      await fs.promises.writeFile(fullPath, buffer);
      
      console.log(`PNG saved to: ${fullPath}`);
    } catch (error) {
      console.error('Error saving PNG file:', error);
      throw new Error(`Failed to save PNG file: ${error}`);
    }
  }

  /**
   * Determine default download directory. Prefer user's Downloads folder; fallback to given fallbackDir.
   */
  private async getDefaultDownloadDirectory(fallbackDir: string): Promise<string> {
    const configService = ConfigService.getInstance();
    const useCustomLocation = configService.get<boolean>('storage.export.useCustomPngLocation');
    const customLocation = configService.get<string>('storage.export.defaultPngLocation');
    
    if (useCustomLocation && customLocation && customLocation.trim()) {
      try {
        const stat = await fs.promises.stat(customLocation);
        if (stat.isDirectory()) {
          return customLocation;
        }
      } catch {
        // Custom location doesn't exist or isn't accessible, fallback to Downloads
      }
    }
    
    try {
      const downloadsDir = path.join(os.homedir(), 'Downloads');
      const stat = await fs.promises.stat(downloadsDir).catch(() => undefined);
      if (stat && stat.isDirectory()) {
        return downloadsDir;
      }
    } catch {
      // ignore and fallback
    }
    return fallbackDir;
  }

  /**
   * Compute the next available filename like {base}_{n}.png inside targetDir.
   */
  private async getNextVersionedPngFilename(targetDir: string, baseName: string): Promise<string> {
    const configService = ConfigService.getInstance();
    const autoIncrement = configService.get<boolean>('storage.export.autoIncrementPngVersions');
    
    if (!autoIncrement) {
      // If auto-increment is disabled, just use the base name
      return `${baseName}.png`;
    }
    
    const files = await fs.promises.readdir(targetDir).catch(() => [] as string[]);
    const escaped = baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`^${escaped}_(\\d+)\\.png$`, 'i');
    let maxVersion = 0;
    for (const file of files) {
      const match = file.match(regex);
      if (match) {
        const n = parseInt(match[1], 10);
        if (!Number.isNaN(n) && n > maxVersion) {
          maxVersion = n;
        }
      }
    }
    const next = maxVersion + 1;
    return `${baseName}_${next}.png`;
  }

  /**
   * Handle configuration update request
   */
  private async handleConfigUpdate(message: any, panel: vscode.WebviewPanel): Promise<void> {
    try {
      const { key, value } = message;
      console.log('Updating configuration:', key, value);
      
      // Map the checkbox keys to actual VS Code configuration keys
      let configKey: string;
      switch (key) {
        case 'showPrints':
          configKey = 'flowchartMachine.nodes.processTypes.prints';
          break;
        case 'detailFunctions':
          configKey = 'flowchartMachine.nodes.processTypes.functions';
          break;
        case 'forLoops':
          configKey = 'flowchartMachine.nodes.processTypes.forLoops';
          break;
        case 'whileLoops':
          configKey = 'flowchartMachine.nodes.processTypes.whileLoops';
          break;
        case 'variables':
          configKey = 'flowchartMachine.nodes.processTypes.variables';
          break;
        case 'ifs':
          configKey = 'flowchartMachine.nodes.processTypes.ifs';
          break;
        case 'imports':
          configKey = 'flowchartMachine.nodes.processTypes.imports';
          break;
        case 'exceptions':
          configKey = 'flowchartMachine.nodes.processTypes.exceptions';
          break;
        default:
          configKey = `flowchartMachine.${key}`;
      }
      
      // Update the VS Code configuration
      await vscode.workspace.getConfiguration().update(configKey, value, vscode.ConfigurationTarget.Global);
      
      // Acknowledge the update
      panel.webview.postMessage({ 
        command: 'configUpdated',
        key,
        value
      });
      
      console.log(`Configuration updated: ${configKey} = ${value}`);
    } catch (error) {
      console.error('Configuration update failed:', error);
      panel.webview.postMessage({ 
        command: 'configUpdated',
        key: message.key,
        value: message.value,
        error: `Configuration update failed: ${error}`
      });
    }
  }
}