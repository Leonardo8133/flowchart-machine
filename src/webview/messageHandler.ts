import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { PythonService } from '../services/pythonService';
import { FileService } from '../services/fileService';
import { ConfigService } from '../services/configService';
import { StorageService } from '../services/storageService';
import { WhitelistService } from '../services/whitelistService';

export class WebviewMessageHandler {
  private originalFilePath?: string;
  private storageService: StorageService;
  private extensionContext: vscode.ExtensionContext;
  private fileService: FileService;
  private whitelistService: WhitelistService | null = null;
  private processor: any = null;
  private currentMetadata: any = null;

  constructor() {
    // Initialize storage service when needed
    this.storageService = null as any;
    this.extensionContext = null as any;
    this.fileService = null as any;
  }

  /**
   * Set up message handling for a webview panel
   */
  setupMessageHandling(panel: vscode.WebviewPanel, originalFilePath?: string, extensionContext?: vscode.ExtensionContext, whitelistService?: WhitelistService, processor?: any): void {
    this.originalFilePath = originalFilePath;
    this.processor = processor;
    if (extensionContext) {
      this.extensionContext = extensionContext;
      this.fileService = new FileService(extensionContext);
    }
    if (whitelistService) {
      this.whitelistService = whitelistService;
    }

    
    panel.webview.onDidReceiveMessage(
      async (message) => {        
        try {
          await this.handleMessage(message, panel, originalFilePath);
        } catch (error) {
          console.error('❌ Error handling webview message:', error);
          panel.webview.postMessage({
            command: 'error',
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    );
    

  }

  /**
   * Handle incoming messages from the webview
   */
  private async handleMessage(message: any, panel: vscode.WebviewPanel, originalFilePath?: string): Promise<void> {    
    switch (message.command) {
      case 'updateFlowchart':
        await this.handleRegeneration(panel);
        break;
        
      case 'createPng':
        await this.handleCreatePng(message, panel);
        break;
      
      case 'createSvg':
        await this.handleCreateSvg(message, panel);
        break;
        
      case 'updateConfig':
        await this.handleConfigUpdate(message, panel);
        break;
      
      case 'saveDiagram':
        await this.handleSaveDiagram(message, panel, originalFilePath);
        break;
        
      case 'getSavedDiagrams':
        await this.handleGetSavedDiagrams(message, panel);
        break;
        
      case 'loadSavedDiagram':
        await this.handleLoadSavedDiagram(message, panel);
        break;

      case 'deleteSavedDiagram':
        await this.handleDeleteSavedDiagram(message, panel);
        break;

      case 'getCurrentCheckboxStatesValues':
        await this.handleGetCurrentCheckboxStatesValues(message, panel);
        break;

      case 'expandSubgraph':
        await this.handleExpandSubgraph(message, panel);
        break;

      case 'collapseSubgraph':
        await this.handleCollapseSubgraph(message, panel);
        break;

      case 'expandAllSubgraphs':
        await this.handleExpandAllSubgraphs(message, panel);
        break;

      case 'collapseAllSubgraphs':
        await this.handleCollapseAllSubgraphs(message, panel);
        break;

      case 'updateMetadata':
        await this.handleUpdateMetadata(message, panel);
        break;

      case 'goToDefinition':
        await this.handleGoToDefinition(message, panel);
        break;
      
      default:

        break;
    }
  }

  /**
   * Public wrapper to trigger regeneration from extension code or tests.
   */
  public async regenerate(panel: vscode.WebviewPanel): Promise<void> {
    await this.handleRegeneration(panel);
  }

  private async handleGetCurrentCheckboxStatesValues(message: any, panel: vscode.WebviewPanel): Promise<void> {
    const checkboxStates = this.getCurrentCheckboxStates();
    panel.webview.postMessage({
      command: 'updateCheckboxStates',
      checkboxStates: checkboxStates
    });
  }

  /**
   * Handle expand subgraph request
   */
  private async handleExpandSubgraph(message: any, panel: vscode.WebviewPanel): Promise<void> {
    try {
      const { scopeName } = message;
      
      if (!scopeName) {
        return;
      }
      
      // Add to whitelist and remove from force collapse list
      const whitelistService = this.getWhitelistService();
      whitelistService.addToWhitelist(scopeName);
      whitelistService.removeFromForceCollapseList(scopeName);
      // Regenerate flowchart with updated lists
      await this.handleRegeneration(panel);
    } catch (error) {
      panel.webview.postMessage({
        command: 'expandError',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Handle collapse subgraph request
   */
  private async handleCollapseSubgraph(message: any, panel: vscode.WebviewPanel): Promise<void> {
    try {
      const { scopeName } = message;

      if (!scopeName) {
        return;
      }

      // Process scope name consistently with how they're processed in updateSubgraphStates
      const processedScopeName = scopeName.replace(/\(\)/g, '').replace(/\(.*\)/g, '').trim();

      // Remove from whitelist and add to force collapse list
      const whitelistService = this.getWhitelistService();
      whitelistService.removeFromWhitelist(processedScopeName);
      whitelistService.addToForceCollapseList(processedScopeName);
      // Regenerate flowchart with updated lists
      await this.handleRegeneration(panel);
    } catch (error) {
      panel.webview.postMessage({
        command: 'collapseError',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async handleExpandAllSubgraphs(message: any, panel: vscode.WebviewPanel): Promise<void> {
    try {
      // Get the whitelist service
      const whitelistService = this.getWhitelistService();

      // Get all subgraphs from the current metadata
      const collapsedSubgraphs = this.currentMetadata?.collapsed_subgraphs || {};
      const allSubgraphs = Object.keys(collapsedSubgraphs);


      // Add all subgraphs to the whitelist
      for (const scopeName of allSubgraphs) {
        const processedScopeName = scopeName.replace(/\(\)/g, '').replace(/\(.*\)/g, '').trim();
        whitelistService.addToWhitelist(processedScopeName);
      }

      // Get the updated whitelist to pass to regeneration
      const currentWhitelist = whitelistService.getWhitelist();

      // Regenerate flowchart with updated lists
      await this.handleRegeneration(panel, currentWhitelist);
    } catch (error) {
      panel.webview.postMessage({
        command: 'expandAllError',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Handle collapse all subgraphs request
   */
  private async handleCollapseAllSubgraphs(message: any, panel: vscode.WebviewPanel): Promise<void> {
    try {
      // Get the whitelist service
      const whitelistService = this.getWhitelistService();

      // Clear both whitelist and force collapse list
      whitelistService.clearWhitelist();
      whitelistService.clearForceCollapseList();

      // Get all available subgraphs from metadata
      const allSubgraphs = this.currentMetadata?.all_subgraphs || [];
      
      if (allSubgraphs.length === 0) {
        // Fallback: if all_subgraphs is not available, use the collapseAllSubgraphs method
        console.warn('all_subgraphs not available in metadata, using fallback method');
        whitelistService.collapseAllSubgraphs();
      } else {
        // Add all available subgraphs to the force collapse list
        for (const scopeName of allSubgraphs) {
          const processedScopeName = scopeName.replace(/\(\)/g, '').replace(/\(.*\)/g, '').trim();
          whitelistService.addToForceCollapseList(processedScopeName);
        }
      }

      // Regenerate flowchart with updated lists
      await this.handleRegeneration(panel);
    } catch (error) {
      panel.webview.postMessage({
        command: 'collapseAllError',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Handle update metadata request
   */
  private async handleUpdateMetadata(message: any, panel: vscode.WebviewPanel): Promise<void> {
    try {
      const { metadata } = message;

      // Store the metadata for use in other methods
      this.currentMetadata = metadata;

      if (metadata && metadata.collapsed_subgraphs) {
        // Send collapsed subgraphs metadata to the webview
        panel.webview.postMessage({
          command: 'storeCollapsedSubgraphs',
          metadata: metadata.collapsed_subgraphs
        });
      }
    } catch (error) {
      console.error('Error updating metadata:', error);
    }
  }

  /**
   * Handle go-to-definition request from the webview
   */
  private async handleGoToDefinition(message: any, panel: vscode.WebviewPanel): Promise<void> {
    try {
      const fnNameRaw: string | undefined = message?.functionName;
      if (!fnNameRaw || !this.currentMetadata) {
        vscode.window.showWarningMessage('Go to Definition: no function or metadata available');
        return;
      }

      // Determine line from metadata
      const fnName = String(fnNameRaw).trim();
      const nameToLineMap = this.currentMetadata.name_to_line_map || {};

      console.log('🔄 Go to Definition - nameToLineMap:', nameToLineMap);
      console.log('🔄 Go to Definition - fnName:', fnName);

      // Try direct lookup first
      let line: number | undefined = nameToLineMap[fnName];

      console.log('🔄 Go to Definition - line:', line);

      // Try with class.method format if not found
      if (line === undefined) {
        for (const [key, value] of Object.entries(nameToLineMap)) {
          if (key.endsWith(`.${fnName}`) || key === fnName) {
            line = value as number;
            break;
          }
        }
      }

      // Try matching subgraph scope naming (class_Class_method)
      if (line === undefined) {
        for (const [key, value] of Object.entries(nameToLineMap)) {
          const simplified = key.replace(/^class_/, '').replace(/_/g, '.');
          if (simplified.endsWith(`.${fnName}`)) {
            line = value as number;
            break;
          }
        }
      }

      if (line === undefined) {
        vscode.window.showInformationMessage(`Could not find line for ${fnName}.`);
        return;
      }

      // Open original file and move cursor
      const filePath = this.currentMetadata.file_path || this.originalFilePath;
      if (!filePath) {
        vscode.window.showInformationMessage('Original file path not available.');
        return;
      }

      const fileUri = vscode.Uri.file(filePath);

      // If already active, just move the cursor
      const active = vscode.window.activeTextEditor;
      if (active && active.document.uri.fsPath === filePath) {
        const l = Math.max(0, (line as number) - 1);
        const pos = new vscode.Position(l, 0);
        active.selection = new vscode.Selection(pos, pos);
        active.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
        return;
      }

      // If the document is visible in any editor group, reveal that one (no duplicate tab)
      const visible = vscode.window.visibleTextEditors.find(ed => ed.document.uri.fsPath === filePath);
      if (visible) {
        const l = Math.max(0, (line as number) - 1);
        const pos = new vscode.Position(l, 0);
        await vscode.window.showTextDocument(visible.document, { viewColumn: visible.viewColumn, preview: false, preserveFocus: false });
        visible.selection = new vscode.Selection(pos, pos);
        visible.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
        return;
      }

      // Otherwise open (or reuse) the document in the active group
      const doc = await vscode.workspace.openTextDocument(fileUri);
      const editor = await vscode.window.showTextDocument(doc, { preview: false });
      const l = Math.max(0, (line as number) - 1);
      const pos = new vscode.Position(l, 0);
      editor.selection = new vscode.Selection(pos, pos);
      editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
    } catch (error) {
      vscode.window.showInformationMessage('Failed to go to definition.');
      console.error('goToDefinition failed:', error);
    }
  }

  /**
   * Get current checkbox states from VS Code configuration
   */
  private getCurrentCheckboxStates(): { 
    showPrints: boolean; 
    showFunctions: boolean;
    showForLoops: boolean;
    showWhileLoops: boolean;
    showVariables: boolean;
    showIfs: boolean;
    showImports: boolean;
    showReturns: boolean;
    showExceptions: boolean;
    showClasses: boolean;
    mergeCommonNodes: boolean;
  } {
    const config = vscode.workspace.getConfiguration('flowchartMachine', vscode.workspace.workspaceFolders?.[0]);
    function getConfig(key: string, fallback: boolean) {
      // Try workspace first, then global
      let value = config.inspect<boolean>(key);
      if (value?.workspaceValue !== undefined) {
        return value.workspaceValue;
      }
      if (value?.globalValue !== undefined) {
        return value.globalValue;
      }
      return fallback;
    }
    return {
      showPrints: getConfig('nodes.processTypes.prints', true),
      showFunctions: getConfig('nodes.processTypes.functions', true),
      showForLoops: getConfig('nodes.processTypes.forLoops', true),
      showWhileLoops: getConfig('nodes.processTypes.whileLoops', true),
      showVariables: getConfig('nodes.processTypes.variables', true),
      showIfs: getConfig('nodes.processTypes.ifs', true),
      showImports: getConfig('nodes.processTypes.imports', true),
      showReturns: getConfig('nodes.processTypes.returns', true),
      showExceptions: getConfig('nodes.processTypes.exceptions', true),
      showClasses: getConfig('nodes.processTypes.classes', true),
      mergeCommonNodes: getConfig('nodes.processTypes.mergeCommonNodes', true)
    };
  }


  /**
   * Handle flowchart regeneration request
   */
  private async handleRegeneration(panel: vscode.WebviewPanel, whitelist?: string[]): Promise<void> {
    try {
      
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

      const scriptPath = this.fileService.getMainScriptPath();

      // Check if the Python script still exists
      if (!FileService.fileExists(scriptPath)) {
        panel.webview.postMessage({ 
          command: 'regenerationError', 
          error: 'Python script not found. Please ensure main.py exists in the extension\'s flowchart directory.' 
        });
        return;
      }

      // Execute the Python script again
      const checkboxStates = this.getCurrentCheckboxStates();
      
      // Create file key from current file path
      const fileKey = this.createFileKey(this.originalFilePath);
      
      const env = {
        ...process.env,
        SHOW_PRINTS: checkboxStates.showPrints ? '1' : '0',
        SHOW_FUNCTIONS: checkboxStates.showFunctions ? '1' : '0',
        SHOW_FOR_LOOPS: checkboxStates.showForLoops ? '1' : '0',
        SHOW_WHILE_LOOPS: checkboxStates.showWhileLoops ? '1' : '0',
        SHOW_VARIABLES: checkboxStates.showVariables ? '1' : '0',
        SHOW_IFS: checkboxStates.showIfs ? '1' : '0',
        SHOW_IMPORTS: checkboxStates.showImports ? '1' : '0',
        SHOW_RETURNS: checkboxStates.showReturns ? '1' : '0',
        SHOW_EXCEPTIONS: checkboxStates.showExceptions ? '1' : '0',
        SHOW_CLASSES: checkboxStates.showClasses ? '1' : '0',
        MERGE_COMMON_NODES: checkboxStates.mergeCommonNodes ? '1' : '0',
        FILE_KEY: fileKey,
      } as Record<string, string>;

      const breakpoints = vscode.debug.breakpoints.filter(bp => 
        (bp as any).location?.uri?.fsPath === this.originalFilePath
      );
      const breakpointLines = breakpoints.map(bp => (bp as any).location?.range?.start?.line + 1).filter(line => line);
      // Add breakpoint info to environment variables
      (env as any).BREAKPOINT_LINES = breakpointLines.join(',');
      (env as any).HAS_BREAKPOINTS = breakpointLines.length > 0 ? '1' : '0';
      // Preserve entry selection from current metadata
      if (this.currentMetadata?.entry_selection) {
        const entrySelection = this.currentMetadata.entry_selection;
        (env as any).ENTRY_TYPE = entrySelection.type;
        (env as any).ENTRY_NAME = entrySelection.name || null;
        (env as any).ENTRY_CLASS = entrySelection.class || null;
      }
      // Get whitelist and force collapse list from WhitelistService
      const whitelistService = this.getWhitelistService();
      const currentWhitelist = whitelist || whitelistService.getWhitelist();
      const forceCollapseList = whitelistService.getForceCollapseList();

      // // Add Entry type to the whitelist:
      // if (this.currentMetadata?.entry_selection) {
      //   const entrySelection = this.currentMetadata.entry_selection;
      //   currentWhitelist.push(entrySelection.name);
      // }


      // Add whitelist to environment variables if provided
      if (currentWhitelist && currentWhitelist.length > 0) {
        (env as any).SUBGRAPH_WHITELIST = currentWhitelist.join(',');
      }

      // Add force collapse list to environment variables if provided
      if (forceCollapseList && forceCollapseList.length > 0) {
        (env as any).FORCE_COLLAPSE_LIST = forceCollapseList.join(',');
      }

      const result = await PythonService.executeScript(scriptPath, [this.originalFilePath], env);
      
      if (!result.success) {
        console.error(`Regeneration error: ${result.error}`);
        panel.webview.postMessage({ 
          command: 'regenerationError', 
          error: `Error generating flowchart: ${result.error}` 
        });
        return;
      }
      // Show Python script output in VS Code output panel
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
        
        // Show notification to help user find the output
        vscode.window.showInformationMessage(
          'Python script output available in "Flowchart Machine - Python Output" panel. View → Output → Flowchart Machine - Python Output'
        );
      }
      
      try {
        // Read the updated files
        const output = this.fileService.readFlowchartOutput(this.originalFilePath);
        const cleanDiagram = FileService.cleanMermaidCode(output.mermaidCode);
        // Store the metadata for use in other methods
        this.currentMetadata = output.metadata;

        // Send the updated diagram to the webview with current state
        panel.webview.postMessage({
          command: 'updateFlowchart',
          diagram: cleanDiagram,
          metadata: output.metadata,
          whitelist: currentWhitelist,
          forceCollapse: forceCollapseList
        });

        // Update the global metadata in the webview
        panel.webview.postMessage({
          command: 'updateMetadata',
          metadata: output.metadata
        });

        // Notify completion
        panel.webview.postMessage({ command: 'regenerationComplete' });
        
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
   * Handle SVG creation request from webview
   */
  private async handleCreateSvg(message: any, panel: vscode.WebviewPanel): Promise<void> {
    try {
      if (message.error) {
        panel.webview.postMessage({ command: 'svgResult', success: false, error: message.error });
        return;
      }

      const { svgData } = message;
      if (!svgData) {
        throw new Error('No SVG data provided');
      }

      if (!this.originalFilePath) {
        throw new Error('Original file path not found');
      }

      const targetDir = await this.getDefaultDownloadDirectory(path.dirname(this.originalFilePath));
      const pythonBase = path.basename(this.originalFilePath, path.extname(this.originalFilePath));
      const filename = await this.getNextVersionedSvgFilename(targetDir, pythonBase);
      const fullPath = path.join(targetDir, filename);

      await this.saveSvgToFile(svgData, fullPath);

      panel.webview.postMessage({ command: 'svgResult', success: true, filename, directory: targetDir });

      vscode.window.showInformationMessage(
        `Flowchart saved as SVG: ${filename} in ${targetDir}`,
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
      console.error('SVG save failed:', error);
      panel.webview.postMessage({ command: 'svgResult', success: false, error: `SVG save failed: ${error}` });
    }
  }

  private async saveSvgToFile(svgData: string, fullPath: string): Promise<void> {
    try {
      const base64Data = svgData.replace(/^data:image\/svg\+xml;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.promises.writeFile(fullPath, buffer, { encoding: 'binary' });
      ;
    } catch (error) {
      console.error('Error saving SVG file:', error);
      throw new Error(`Failed to save SVG file: ${error}`);
    }
  }

  private async getNextVersionedSvgFilename(targetDir: string, baseName: string): Promise<string> {
    const files = await fs.promises.readdir(targetDir).catch(() => [] as string[]);
    const escaped = baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`^${escaped}_(\\d+)\\.svg$`, 'i');
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
    return `${baseName}_${next}.svg`;
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
   * Handle save diagram command
   */
  private async handleSaveDiagram(message: any, panel: vscode.WebviewPanel, originalFilePath?: string): Promise<void> {
    try {
      // Initialize storage service if not already done
      if (!this.storageService) {
        this.storageService = new StorageService(this.extensionContext);
      }

      const { mermaidCode } = message;
      
      if (!mermaidCode || typeof mermaidCode !== 'string') {
        panel.webview.postMessage({
          command: 'saveDiagramResult',
          success: false,
          error: 'Invalid mermaid code provided'
        });
        return;
      }

      const result = await this.storageService.saveFlowchart(mermaidCode, originalFilePath);
      if (result.success) {
        panel.webview.postMessage({
          command: 'saveDiagramResult',
          success: true,
          savedFlowchart: result.savedFlowchart
        });
        
        // Show success notification with button to open folder
        const openFolder = 'Open Folder';
        vscode.window.showInformationMessage('Flowchart saved successfully!', openFolder).then(selection => {
          if (selection === openFolder) {
            const folderPath = this.storageService.getStorageDirectory();
            vscode.env.openExternal(vscode.Uri.file(folderPath));
          }
        });
      } else {
        panel.webview.postMessage({
          command: 'saveDiagramResult',
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      panel.webview.postMessage({
        command: 'saveDiagramResult',
        success: false,
        error: errorMessage
      });
    }
  }

  /**
   * Handle get saved diagrams command
   */
  private async handleGetSavedDiagrams(message: any, panel: vscode.WebviewPanel): Promise<void> {
    try {
      // Initialize storage service if not already done
      if (!this.storageService) {
        this.storageService = new StorageService(this.extensionContext);
      }

      const result = await this.storageService.getSavedFlowcharts();
      
      if (result.success) {
        panel.webview.postMessage({
          command: 'savedDiagramsList',
          success: true,
          flowcharts: result.flowcharts
        });
      } else {
        panel.webview.postMessage({
          command: 'savedDiagramsList',
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      panel.webview.postMessage({
        command: 'savedDiagramsList',
        success: false,
        error: errorMessage
      });
    }
  }

  /**
   * Handle load saved diagram command
   */
  private async handleLoadSavedDiagram(message: any, panel: vscode.WebviewPanel): Promise<void> {
    try {
      // Initialize storage service if not already done
      if (!this.storageService) {
        this.storageService = new StorageService(this.extensionContext);
      }

      const { id } = message;
      
      if (!id || typeof id !== 'string') {
        panel.webview.postMessage({
          command: 'loadSavedDiagramResult',
          success: false,
          error: 'Invalid diagram ID provided'
        });
        return;
      }

      const result = await this.storageService.loadFlowchart(id);
      
      if (result.success && result.flowchart) {
        // Get current state from whitelistService
        const whitelistService = this.getWhitelistService();
        const currentWhitelist = whitelistService.getWhitelist();
        const forceCollapseList = whitelistService.getForceCollapseList();

        // Update the webview with the loaded diagram and current state
        panel.webview.postMessage({
          command: 'updateFlowchart',
          diagram: result.flowchart.mermaidCode,
          whitelist: currentWhitelist,
          forceCollapse: forceCollapseList,
          savedDiagram: result.flowchart
        });

        // Show success notification
        vscode.window.showInformationMessage(`Loaded saved flowchart: ${result.flowchart.name}`);
      } else {
        panel.webview.postMessage({
          command: 'loadSavedDiagramResult',
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      panel.webview.postMessage({
        command: 'loadSavedDiagramResult',
        success: false,
        error: errorMessage
      });
    }
  }

  /**
   * Handle delete saved diagram request
   */
  private async handleDeleteSavedDiagram(message: any, panel: vscode.WebviewPanel): Promise<void> {
    try {
      
      if (!this.storageService) {
        this.storageService = new StorageService(this.extensionContext!);
      }
      
      const { id } = message;
      
      if (!id || typeof id !== 'string') {
        panel.webview.postMessage({
          command: 'deleteSavedDiagramResult',
          success: false,
          error: 'Invalid diagram ID provided'
        });
        return;
      }

      const result = await this.storageService.deleteFlowchart(id);
      
      if (result.success) {
        // Show success notification
        vscode.window.showInformationMessage(`Deleted saved flowchart: ${result.flowchart?.name || 'Unknown'}`);
        
        // Send success response
        panel.webview.postMessage({
          command: 'deleteSavedDiagramResult',
          success: true,
          id: id
        });
        
        // Refresh the saved diagrams list
        const flowcharts = await this.storageService.getSavedFlowcharts();
        panel.webview.postMessage({
          command: 'savedDiagramsList',
          flowcharts: flowcharts
        });
      } else {
        panel.webview.postMessage({
          command: 'deleteSavedDiagramResult',
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ Error deleting saved diagram:', error);
      panel.webview.postMessage({
        command: 'deleteSavedDiagramResult',
        success: false,
        error: errorMessage
      });
    }
  }

  /**
   * Handle configuration update request
   */
  private async handleConfigUpdate(message: any, panel: vscode.WebviewPanel): Promise<void> {
    try {
      const { key, value } = message;
      
      // Validate message
      if (key === undefined || value === undefined) {
        throw new Error(`Invalid message format: key=${key}, value=${value}`);
      }
      
      // Map the checkbox keys to actual VS Code configuration keys
      let configKey: string;
      switch (key) {
        case 'showPrints':
          configKey = 'flowchartMachine.nodes.processTypes.prints';
          break;
        case 'showFunctions':
          configKey = 'flowchartMachine.nodes.processTypes.functions';
          break;
        case 'showForLoops':
          configKey = 'flowchartMachine.nodes.processTypes.forLoops';
          break;
        case 'showWhileLoops':
          configKey = 'flowchartMachine.nodes.processTypes.whileLoops';
          break;
        case 'showVariables':
          configKey = 'flowchartMachine.nodes.processTypes.variables';
          break;
        case 'showIfs':
          configKey = 'flowchartMachine.nodes.processTypes.ifs';
          break;
        case 'showImports':
          configKey = 'flowchartMachine.nodes.processTypes.imports';
          break;
        case 'showReturns':
          configKey = 'flowchartMachine.nodes.processTypes.returns';
          break;
        case 'showExceptions':
          configKey = 'flowchartMachine.nodes.processTypes.exceptions';
          break;
        case 'showClasses':
          configKey = 'flowchartMachine.nodes.processTypes.classes';
          break;
        case 'mergeCommonNodes':
          configKey = 'flowchartMachine.nodes.processTypes.mergeCommonNodes';
          break;
        default:
          configKey = `flowchartMachine.${key}`;
      }
      
      // Update the VS Code configuration
      try {
        await vscode.workspace.getConfiguration().update(configKey, value, vscode.ConfigurationTarget.Workspace);
      } catch (workspaceError) {
        console.error('🔧 Workspace update failed:', workspaceError);
      }
      
      // Verify the update by reading it back
      const updatedValue = vscode.workspace.getConfiguration().get(configKey);      
      // Check if either update worked
      if (updatedValue !== value) {
        throw new Error(`Configuration update failed: expected ${value}, got ${updatedValue}.`);
      }
      
      // Show success notification to user
      vscode.window.showInformationMessage(`Setting updated: ${key} = ${value ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('🔧 Configuration update failed:', error);
    }
  }

  /**
   * Get or create WhitelistService for the current file
   */
  private getWhitelistService(): WhitelistService {
    if (!this.whitelistService && this.originalFilePath) {
      this.whitelistService = new WhitelistService(this.createFileKey(this.originalFilePath));
      this.whitelistService.startSession();
    }
    if (!this.whitelistService) {
      throw new Error('WhitelistService not initialized and no original file path available');
    }
    return this.whitelistService;
  }

  /**
   * Create file key in format (parent)/(filename) from file path
   */
  private createFileKey(filePath: string): string {
    const path = require('path');
    const parentDir = path.basename(path.dirname(filePath));
    const fileName = path.basename(filePath, path.extname(filePath));
    return `(${parentDir})/(${fileName})`;
  }
}