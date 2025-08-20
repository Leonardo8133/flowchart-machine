import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export interface SavedFlowchart {
  id: string;
  name: string;
  filename: string;
  mermaidCode: string;
  savedAt: string;
  filePath?: string;
}

export class StorageService {
  private context: vscode.ExtensionContext;
  private storageDir: string;
  private metadataFile: string;

  constructor(context: vscode.ExtensionContext) {
    console.log('StorageService constructor called with context:', !!context);
    this.context = context;
    this.storageDir = path.join(context.globalStorageUri.fsPath, 'saved-flowcharts');
    this.metadataFile = path.join(this.storageDir, 'metadata.json');
    console.log('Storage directory:', this.storageDir);
    console.log('Metadata file:', this.metadataFile);
    this.ensureStorageDirectory();
  }

  private ensureStorageDirectory(): void {
    console.log('Ensuring storage directory exists:', this.storageDir);
    try {
      if (!fs.existsSync(this.storageDir)) {
        console.log('Creating storage directory...');
        fs.mkdirSync(this.storageDir, { recursive: true });
        console.log('Storage directory created successfully');
      } else {
        console.log('Storage directory already exists');
      }
    } catch (error) {
      console.error('Error ensuring storage directory:', error);
      throw new Error(`Failed to create storage directory: ${error}`);
    }
  }

  /**
   * Save a flowchart with metadata
   */
  async saveFlowchart(mermaidCode: string, originalFilePath?: string): Promise<{ success: boolean; error?: string; savedFlowchart?: SavedFlowchart }> {
    try {
      console.log('saveFlowchart called with mermaidCode length:', mermaidCode.length);
      console.log('Original file path:', originalFilePath);
      
      const timestamp = new Date().toISOString();
      const id = this.generateId();
      const name = this.generateName(originalFilePath);
      const filename = `${id}.mmd`;
      const filePath = path.join(this.storageDir, filename);
      
      console.log('Generated ID:', id);
      console.log('Generated name:', name);
      console.log('File path:', filePath);

      // Save the mermaid code to file
      try {
        fs.writeFileSync(filePath, mermaidCode, 'utf8');
      } catch (writeError) {
        throw new Error(`Failed to write mermaid code to file: ${writeError}`);
      }

      // Create metadata
      const savedFlowchart: SavedFlowchart = {
        id,
        name,
        filename,
        mermaidCode,
        savedAt: timestamp,
        filePath: originalFilePath
      };

      // Update metadata file
      console.log('Updating metadata file...');
      await this.updateMetadata(savedFlowchart);
      console.log('Metadata updated successfully');

      return { success: true, savedFlowchart };
    } catch (error) {
      console.error('Error in saveFlowchart:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get all saved flowcharts (max 50)
   */
  async getSavedFlowcharts(): Promise<{ success: boolean; error?: string; flowcharts?: SavedFlowchart[] }> {
    try {
      if (!fs.existsSync(this.metadataFile)) {
        return { success: true, flowcharts: [] };
      }

      const metadataContent = fs.readFileSync(this.metadataFile, 'utf8');
      const metadata = JSON.parse(metadataContent);
      
      // Sort by saved date (newest first) and limit to 50
      const sortedFlowcharts = (Object.values(metadata) as SavedFlowchart[])
        .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())
        .slice(0, 50);

      return { success: true, flowcharts: sortedFlowcharts };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Load a specific flowchart by ID
   */
  async loadFlowchart(id: string): Promise<{ success: boolean; error?: string; flowchart?: SavedFlowchart }> {
    try {
      if (!fs.existsSync(this.metadataFile)) {
        return { success: false, error: 'No saved flowcharts found' };
      }

      const metadataContent = fs.readFileSync(this.metadataFile, 'utf8');
      const metadata = JSON.parse(metadataContent);
      
      if (!metadata[id]) {
        return { success: false, error: 'Flowchart not found' };
      }

      return { success: true, flowchart: metadata[id] };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get the storage directory path for user access
   */
  getStorageDirectory(): string {
    return this.storageDir;
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private generateName(originalFilePath?: string): string {
    if (originalFilePath) {
      const pathParts = originalFilePath.split(path.sep);
      if (pathParts.length >= 2) {
        const parentFolder = pathParts[pathParts.length - 2];
        const filename = path.basename(originalFilePath, path.extname(originalFilePath));
        return `${parentFolder}/${filename}.py`;
      } else {
        // Fallback if no parent folder
        const filename = path.basename(originalFilePath, path.extname(originalFilePath));
        return filename;
      }
    }
    return `Flowchart_${new Date().toLocaleDateString()}`;
  }

  private async updateMetadata(savedFlowchart: SavedFlowchart): Promise<void> {
    console.log('updateMetadata called for flowchart:', savedFlowchart.id);
    let metadata: Record<string, SavedFlowchart> = {};
    
    try {
      if (fs.existsSync(this.metadataFile)) {
        console.log('Reading existing metadata file...');
        const content = fs.readFileSync(this.metadataFile, 'utf8');
        metadata = JSON.parse(content);
        console.log('Existing metadata loaded, count:', Object.keys(metadata).length);
      } else {
        console.log('No existing metadata file found, creating new one');
      }

      metadata[savedFlowchart.id] = savedFlowchart;
      console.log('Writing updated metadata to file...');
      fs.writeFileSync(this.metadataFile, JSON.stringify(metadata, null, 2), 'utf8');
      console.log('Metadata file updated successfully');
    } catch (error) {
      console.error('Error updating metadata:', error);
      throw new Error(`Failed to update metadata: ${error}`);
    }
  }

  /**
   * Delete a flowchart by ID
   */
  async deleteFlowchart(id: string): Promise<{ success: boolean; flowchart?: SavedFlowchart; error?: string }> {
    try {
      console.log('🗑️ Deleting flowchart with ID:', id);
      
      if (!fs.existsSync(this.metadataFile)) {
        return { success: false, error: 'No saved flowcharts found' };
      }
      
      const metadataContent = fs.readFileSync(this.metadataFile, 'utf8');
      const metadata = JSON.parse(metadataContent);
      
      const flowchart = metadata[id];
      if (!flowchart) {
        return { success: false, error: 'Flowchart not found' };
      }
      
      // Delete the .mmd file
      const mmdFilePath = path.join(this.storageDir, `${id}.mmd`);
      if (fs.existsSync(mmdFilePath)) {
        fs.unlinkSync(mmdFilePath);
        console.log('🗑️ Deleted .mmd file:', mmdFilePath);
      }
      
      // Remove from metadata
      delete metadata[id];
      
      // Write updated metadata
      fs.writeFileSync(this.metadataFile, JSON.stringify(metadata, null, 2));
      console.log('🗑️ Updated metadata file');
      
      console.log('✅ Flowchart deleted successfully:', flowchart.name);
      return { success: true, flowchart };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ Error deleting flowchart:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }
}
