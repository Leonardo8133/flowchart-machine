import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { SavedFlowchart, FlowchartMetadata } from '../types/config';
import { ConfigService } from './configService';
import { generateId } from '../utils/helpers';

/**
 * Service for storing and retrieving saved flowcharts
 */
export class StorageService {
  private static instance: StorageService;
  private configService: ConfigService;
  private storagePath: string;
  private flowcharts: Map<string, SavedFlowchart> = new Map();

  private constructor() {
    this.configService = ConfigService.getInstance();
    this.storagePath = this.getStoragePath();
    this.loadSavedFlowcharts();
    this.setupAutoCleanup();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  /**
   * Save a flowchart for later use
   */
  async saveFlowchart(
    sourceFile: string,
    mermaidCode: string,
    tooltipData: any,
    metadata: Partial<FlowchartMetadata>,
    tags: string[] = [],
    notes?: string
  ): Promise<string> {
    if (!this.configService.isAutoSaveEnabled()) {
      return '';
    }

    try {
      const id = generateId();
      const now = new Date();
      
      const savedFlowchart: SavedFlowchart = {
        id,
        sourceFile,
        flowchart: {
          mermaidCode,
          tooltipData: this.configService.get('storage.includeTooltipData') ? tooltipData : {},
          metadata: {
            nodeCount: metadata.nodeCount || 0,
            nodeTypes: metadata.nodeTypes || [],
            sourceFileSize: metadata.sourceFileSize || 0,
            processingTime: metadata.processingTime || 0,
            scriptVersion: metadata.scriptVersion,
            extensionVersion: metadata.extensionVersion || '1.0.0',
          },
        },
        createdAt: now,
        lastAccessed: now,
        tags,
        notes,
      };

      // Add source code if configured
      if (this.configService.get('storage.includeSourceCode')) {
        try {
          const sourceCode = fs.readFileSync(sourceFile, 'utf-8');
          (savedFlowchart.flowchart as any).sourceCode = sourceCode;
        } catch (error) {
          console.warn('Failed to include source code:', error);
        }
      }

      // Store in memory
      this.flowcharts.set(id, savedFlowchart);

      // Save to file
      await this.saveToFile(savedFlowchart);

      // Check if we need to clean up old flowcharts
      await this.cleanupOldFlowcharts();

      return id;
    } catch (error) {
      console.error('Failed to save flowchart:', error);
      throw error;
    }
  }

  /**
   * Load a saved flowchart by ID
   */
  async loadFlowchart(id: string): Promise<SavedFlowchart | null> {
    try {
      const flowchart = this.flowcharts.get(id);
      if (flowchart) {
        // Update last accessed time
        flowchart.lastAccessed = new Date();
        await this.saveToFile(flowchart);
        return flowchart;
      }
      return null;
    } catch (error) {
      console.error('Failed to load flowchart:', error);
      return null;
    }
  }

  /**
   * Get all saved flowcharts
   */
  getAllFlowcharts(): SavedFlowchart[] {
    return Array.from(this.flowcharts.values()).sort((a, b) => 
      b.lastAccessed.getTime() - a.lastAccessed.getTime()
    );
  }

  /**
   * Search flowcharts by criteria
   */
  searchFlowcharts(query: {
    tags?: string[];
    sourceFile?: string;
    dateRange?: { start: Date; end: Date };
    nodeTypes?: string[];
  }): SavedFlowchart[] {
    let results = this.getAllFlowcharts();

    if (query.tags && query.tags.length > 0) {
      results = results.filter(f => 
        query.tags!.some(tag => f.tags.includes(tag))
      );
    }

    if (query.sourceFile) {
      results = results.filter(f => 
        f.sourceFile.toLowerCase().includes(query.sourceFile!.toLowerCase())
      );
    }

    if (query.dateRange) {
      results = results.filter(f => 
        f.createdAt >= query.dateRange!.start && f.createdAt <= query.dateRange!.end
      );
    }

    if (query.nodeTypes && query.nodeTypes.length > 0) {
      results = results.filter(f => 
        query.nodeTypes!.some(type => f.flowchart.metadata.nodeTypes.includes(type))
      );
    }

    return results;
  }

  /**
   * Update flowchart metadata
   */
  async updateFlowchart(
    id: string, 
    updates: Partial<Pick<SavedFlowchart, 'tags' | 'notes'>>
  ): Promise<boolean> {
    try {
      const flowchart = this.flowcharts.get(id);
      if (!flowchart) {
        return false;
      }

      if (updates.tags) {
        flowchart.tags = updates.tags;
      }
      if (updates.notes !== undefined) {
        flowchart.notes = updates.notes;
      }

      flowchart.lastAccessed = new Date();
      await this.saveToFile(flowchart);
      return true;
    } catch (error) {
      console.error('Failed to update flowchart:', error);
      return false;
    }
  }

  /**
   * Delete a saved flowchart
   */
  async deleteFlowchart(id: string): Promise<boolean> {
    try {
      const flowchart = this.flowcharts.get(id);
      if (!flowchart) {
        return false;
      }

      // Remove from memory
      this.flowcharts.delete(id);

      // Remove from file
      const filePath = path.join(this.storagePath, `${id}.json`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      return true;
    } catch (error) {
      console.error('Failed to delete flowchart:', error);
      return false;
    }
  }

  /**
   * Export all flowcharts to a single file
   */
  async exportAllFlowcharts(): Promise<void> {
    try {
      const uri = await vscode.window.showSaveDialog({
        filters: { 'JSON': ['json'] },
        defaultUri: vscode.Uri.file('flowchart-machine-export.json'),
      });
      
      if (uri) {
        const exportData = {
          exportedAt: new Date().toISOString(),
          version: '1.0.0',
          flowcharts: Array.from(this.flowcharts.values()),
        };
        
        const content = JSON.stringify(exportData, null, 2);
        await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf-8'));
        vscode.window.showInformationMessage('All flowcharts exported successfully');
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to export flowcharts: ${error}`);
    }
  }

  /**
   * Import flowcharts from export file
   */
  async importFlowcharts(): Promise<void> {
    try {
      const uris = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        filters: { 'JSON': ['json'] },
      });
      
      if (uris && uris.length > 0) {
        const content = await vscode.workspace.fs.readFile(uris[0]);
        const importData = JSON.parse(content.toString());
        
        if (importData.flowcharts && Array.isArray(importData.flowcharts)) {
          let importedCount = 0;
          
          for (const flowchart of importData.flowcharts) {
            if (this.validateFlowchart(flowchart)) {
              // Generate new ID to avoid conflicts
              const newId = generateId();
              flowchart.id = newId;
              flowchart.createdAt = new Date();
              flowchart.lastAccessed = new Date();
              
              this.flowcharts.set(newId, flowchart);
              await this.saveToFile(flowchart);
              importedCount++;
            }
          }
          
          vscode.window.showInformationMessage(`Imported ${importedCount} flowcharts successfully`);
        } else {
          vscode.window.showErrorMessage('Invalid export file format');
        }
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to import flowcharts: ${error}`);
    }
  }

  /**
   * Get storage statistics
   */
  getStorageStats(): {
    totalFlowcharts: number;
    totalSize: number;
    oldestFlowchart: Date | null;
    newestFlowchart: Date | null;
    mostUsedTags: Array<{ tag: string; count: number }>;
  } {
    const flowcharts = this.getAllFlowcharts();
    const totalFlowcharts = flowcharts.length;
    
    let totalSize = 0;
    const tagCounts: Map<string, number> = new Map();
    
    flowcharts.forEach(f => {
      totalSize += JSON.stringify(f).length;
      f.tags.forEach(tag => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    });

    const mostUsedTags = Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalFlowcharts,
      totalSize,
      oldestFlowchart: flowcharts.length > 0 ? flowcharts[flowcharts.length - 1].createdAt : null,
      newestFlowchart: flowcharts.length > 0 ? flowcharts[0].createdAt : null,
      mostUsedTags,
    };
  }

  /**
   * Get the storage path based on configuration
   */
  private getStoragePath(): string {
    const location = this.configService.get<'workspace' | 'global'>('storage.storageLocation');
    
    if (location === 'workspace') {
      return path.join(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '', '.flowchart-machine');
    } else {
      // Use user home directory as fallback for global storage
      const homeDir = process.env.APPDATA || process.env.HOME || process.env.USERPROFILE || '';
      return path.join(homeDir, 'flowchart-machine');
    }
  }

  /**
   * Load all saved flowcharts from storage
   */
  private async loadSavedFlowcharts(): Promise<void> {
    try {
      if (!fs.existsSync(this.storagePath)) {
        fs.mkdirSync(this.storagePath, { recursive: true });
        return;
      }

      const files = fs.readdirSync(this.storagePath);
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const filePath = path.join(this.storagePath, file);
            const content = fs.readFileSync(filePath, 'utf-8');
            const flowchart: SavedFlowchart = JSON.parse(content);
            
            // Convert date strings back to Date objects
            flowchart.createdAt = new Date(flowchart.createdAt);
            flowchart.lastAccessed = new Date(flowchart.lastAccessed);
            
            if (this.validateFlowchart(flowchart)) {
              this.flowcharts.set(flowchart.id, flowchart);
            }
          } catch (error) {
            console.warn(`Failed to load flowchart file ${file}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load saved flowcharts:', error);
    }
  }

  /**
   * Save flowchart to file
   */
  private async saveToFile(flowchart: SavedFlowchart): Promise<void> {
    try {
      if (!fs.existsSync(this.storagePath)) {
        fs.mkdirSync(this.storagePath, { recursive: true });
      }

      const filePath = path.join(this.storagePath, `${flowchart.id}.json`);
      const content = JSON.stringify(flowchart, null, 2);
      fs.writeFileSync(filePath, content, 'utf-8');
    } catch (error) {
      console.error('Failed to save flowchart to file:', error);
      throw error;
    }
  }

  /**
   * Clean up old flowcharts based on configuration
   */
  private async cleanupOldFlowcharts(): Promise<void> {
    try {
      const maxFlowcharts = this.configService.get<number>('storage.maxSavedFlowcharts');
      const autoCleanupDays = this.configService.get<number>('storage.autoCleanupDays');
      
      if (this.flowcharts.size <= maxFlowcharts) {
        return;
      }

      // Sort by last accessed time and remove oldest
      const sortedFlowcharts = this.getAllFlowcharts();
      const toRemove = sortedFlowcharts.slice(maxFlowcharts);
      
      for (const flowchart of toRemove) {
        await this.deleteFlowchart(flowchart.id);
      }

      // Also remove flowcharts older than autoCleanupDays
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - autoCleanupDays);
      
      const oldFlowcharts = sortedFlowcharts.filter(f => f.createdAt < cutoffDate);
      for (const flowchart of oldFlowcharts) {
        await this.deleteFlowchart(flowchart.id);
      }
    } catch (error) {
      console.error('Failed to cleanup old flowcharts:', error);
    }
  }

  /**
   * Setup automatic cleanup
   */
  private setupAutoCleanup(): void {
    // Clean up every hour
    setInterval(() => {
      this.cleanupOldFlowcharts();
    }, 60 * 60 * 1000);
  }

  /**
   * Validate flowchart data structure
   */
  private validateFlowchart(flowchart: any): flowchart is SavedFlowchart {
    return (
      flowchart &&
      typeof flowchart.id === 'string' &&
      typeof flowchart.sourceFile === 'string' &&
      flowchart.flowchart &&
      typeof flowchart.flowchart.mermaidCode === 'string' &&
      flowchart.createdAt &&
      flowchart.lastAccessed
    );
  }
}
