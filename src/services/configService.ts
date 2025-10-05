import * as vscode from 'vscode';
import { FlowchartConfig, ConfigurationKey, ConfigurationChangeEvent } from '../types/config';
import { DEFAULT_CONFIG } from '../config/defaults';

/**
 * Service for managing extension configuration
 */
export class ConfigService {
  private static instance: ConfigService;
  private config: FlowchartConfig;
  private changeListeners: Array<(event: ConfigurationChangeEvent) => void> = [];

  private constructor() {
    this.config = this.loadConfiguration();
    this.setupConfigurationWatcher();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  /**
   * Get the current configuration
   */
  getConfig(): FlowchartConfig {
    return { ...this.config };
  }

  /**
   * Get a specific configuration value using dot notation
   */
  get<T>(key: ConfigurationKey): T {
    const keys = key.split('.');
    let value: any = this.config;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return this.getDefaultValue(key);
      }
    }
    
    return value;
  }

  /**
   * Set a configuration value
   */
  set<T>(key: ConfigurationKey, value: T): void {
    const keys = key.split('.');
    const oldValue = this.get(key);

    // Update the configuration
    let current: any = this.config;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!(keys[i] in current)) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }

    current[keys[keys.length - 1]] = value;

    // Re-normalize to keep structure aligned with exports
    this.config = this.normalizeConfigStructure(this.config);

    // Update VS Code configuration
    this.updateVSCodeConfig(key, value);

    // Notify listeners
    this.notifyChangeListeners(key, oldValue, value);
  }

  /**
   * Reset configuration to defaults
   */
  resetToDefaults(): void {
    this.config = this.normalizeConfigStructure(DEFAULT_CONFIG);
    this.saveConfiguration();
    vscode.window.showInformationMessage('Configuration reset to defaults');
  }

  /**
   * Export configuration to file
   */
  async exportConfig(): Promise<void> {
    try {
      const uri = await vscode.window.showSaveDialog({
        filters: { 'JSON': ['json'] },
        defaultUri: vscode.Uri.file('flowchart-machine-config.json'),
      });
      
      if (uri) {
        const normalized = this.normalizeConfigStructure(this.config);
        this.config = normalized;
        const content = JSON.stringify(normalized, null, 2);
        await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf-8'));
        vscode.window.showInformationMessage('Configuration exported successfully');
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to export configuration: ${error}`);
    }
  }

  /**
   * Import configuration from file
   */
  async importConfig(): Promise<void> {
    try {
      const uris = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        filters: { 'JSON': ['json'] },
      });
      
      if (uris && uris.length > 0) {
        const content = await vscode.workspace.fs.readFile(uris[0]);
        const importedConfig = JSON.parse(content.toString());

        // Validate imported configuration
        if (this.validateConfig(importedConfig)) {
          this.config = this.normalizeConfigStructure(importedConfig);
          this.saveConfiguration();
          vscode.window.showInformationMessage('Configuration imported successfully');
        } else {
          vscode.window.showErrorMessage('Invalid configuration file format');
        }
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to import configuration: ${error}`);
    }
  }

  /**
   * Add a configuration change listener
   */
  addChangeListener(listener: (event: ConfigurationChangeEvent) => void): vscode.Disposable {
    this.changeListeners.push(listener);
    
    return {
      dispose: () => {
        const index = this.changeListeners.indexOf(listener);
        if (index > -1) {
          this.changeListeners.splice(index, 1);
        }
      }
    };
  }

  /**
   * Check if auto-save is enabled
   */
  isAutoSaveEnabled(): boolean {
    return this.get<boolean>('general.autoSave');
  }

  /**
   * Load configuration from VS Code settings
   */
  private loadConfiguration(): FlowchartConfig {
    const config = vscode.workspace.getConfiguration('flowchartMachine');
    const loadedConfig: FlowchartConfig = {
      general: {
        autoSave: config.get('general.autoSave', DEFAULT_CONFIG.general.autoSave),
        showNotifications: config.get('general.showNotifications', DEFAULT_CONFIG.general.showNotifications),
      },
      nodes: {
        processTypes: {
          prints: config.get('nodes.processTypes.prints', DEFAULT_CONFIG.nodes.processTypes.prints),
          functions: config.get('nodes.processTypes.functions', DEFAULT_CONFIG.nodes.processTypes.functions),
          forLoops: config.get('nodes.processTypes.forLoops', DEFAULT_CONFIG.nodes.processTypes.forLoops),
          whileLoops: config.get('nodes.processTypes.whileLoops', DEFAULT_CONFIG.nodes.processTypes.whileLoops),
          variables: config.get('nodes.processTypes.variables', DEFAULT_CONFIG.nodes.processTypes.variables),
          ifs: config.get('nodes.processTypes.ifs', DEFAULT_CONFIG.nodes.processTypes.ifs),
          imports: config.get('nodes.processTypes.imports', DEFAULT_CONFIG.nodes.processTypes.imports),
          exceptions: config.get('nodes.processTypes.exceptions', DEFAULT_CONFIG.nodes.processTypes.exceptions),
        },
      },
      storage: {
        saveFlowcharts: true, // Default value, not configurable
        maxSavedFlowcharts: config.get('storage.maxSavedFlowcharts', DEFAULT_CONFIG.storage.maxSavedFlowcharts),
        storageLocation: config.get('storage.storageLocation', DEFAULT_CONFIG.storage.storageLocation),
        includeSourceCode: config.get('storage.includeSourceCode', DEFAULT_CONFIG.storage.includeSourceCode),
        autoCleanupDays: config.get('storage.autoCleanupDays', DEFAULT_CONFIG.storage.autoCleanupDays),
        export: {
          defaultPngLocation: config.get('storage.export.defaultPngLocation', DEFAULT_CONFIG.storage.export.defaultPngLocation),
          useCustomPngLocation: config.get('storage.export.useCustomPngLocation', DEFAULT_CONFIG.storage.export.useCustomPngLocation),
          autoIncrementPngVersions: config.get('storage.export.autoIncrementPngVersions', DEFAULT_CONFIG.storage.export.autoIncrementPngVersions),
        },
      },
      appearance: DEFAULT_CONFIG.appearance, // Use defaults, not configurable
      performance: DEFAULT_CONFIG.performance, // Use defaults, not configurable
    };
    
    // Load node processing types
    loadedConfig.nodes.processTypes = {
      prints: config.get('nodes.processTypes.prints', DEFAULT_CONFIG.nodes.processTypes.prints),
      functions: config.get('nodes.processTypes.functions', DEFAULT_CONFIG.nodes.processTypes.functions),
      forLoops: config.get('nodes.processTypes.forLoops', DEFAULT_CONFIG.nodes.processTypes.forLoops),
      whileLoops: config.get('nodes.processTypes.whileLoops', DEFAULT_CONFIG.nodes.processTypes.whileLoops),
      variables: config.get('nodes.processTypes.variables', DEFAULT_CONFIG.nodes.processTypes.variables),
      ifs: config.get('nodes.processTypes.ifs', DEFAULT_CONFIG.nodes.processTypes.ifs),
      imports: config.get('nodes.processTypes.imports', DEFAULT_CONFIG.nodes.processTypes.imports),
      exceptions: config.get('nodes.processTypes.exceptions', DEFAULT_CONFIG.nodes.processTypes.exceptions),
    };
    
    return this.normalizeConfigStructure(loadedConfig);
  }

  /**
   * Save configuration to VS Code settings
   */
  private saveConfiguration(): void {
    const config = vscode.workspace.getConfiguration('flowchartMachine');
    
    // Update each section
    Object.entries(this.config).forEach(([section, sectionConfig]) => {
      Object.entries(sectionConfig).forEach(([key, value]) => {
        if (typeof value === 'object' && value !== null) {
          Object.entries(value).forEach(([subKey, subValue]) => {
            config.update(`${section}.${key}.${subKey}`, subValue, vscode.ConfigurationTarget.Workspace);
          });
        } else {
          config.update(`${section}.${key}`, value, vscode.ConfigurationTarget.Workspace);
        }
      });
    });
  }

  /**
   * Update VS Code configuration
   */
  private updateVSCodeConfig(key: ConfigurationKey, value: any): void {
    const config = vscode.workspace.getConfiguration('flowchartMachine');
    config.update(key.replace('flowchartMachine.', ''), value, vscode.ConfigurationTarget.Workspace);
  }

  /**
   * Setup configuration change watcher
   */
  private setupConfigurationWatcher(): void {
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('flowchartMachine')) {
        this.config = this.loadConfiguration();
        vscode.window.showInformationMessage('Flowchart Machine configuration updated');
      }
    });
  }

  /**
   * Get default value for a configuration key
   */
  private getDefaultValue<T>(key: ConfigurationKey): T {
    const keys = key.split('.');
    let value: any = DEFAULT_CONFIG;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        throw new Error(`Invalid configuration key: ${key}`);
      }
    }
    
    return value;
  }

  /**
   * Validate imported configuration
   */
  private validateConfig(config: any): boolean {
    try {
      this.normalizeConfigStructure(config);
      return true;
    } catch {
      return false;
    }
  }

  private normalizeConfigStructure(rawConfig: any): FlowchartConfig {
    if (!rawConfig || typeof rawConfig !== 'object') {
      throw new Error('Configuration must be an object');
    }

    const general = rawConfig.general ?? {};
    const nodes = rawConfig.nodes ?? {};
    const processTypes = nodes.processTypes ?? {};
    const storage = rawConfig.storage ?? {};
    const exportSettings = storage.export ?? {};
    const appearance = rawConfig.appearance ?? {};
    const performance = rawConfig.performance ?? {};

    return {
      general: {
        autoSave: this.coerceBoolean(general.autoSave, DEFAULT_CONFIG.general.autoSave),
        showNotifications: this.coerceBoolean(general.showNotifications, DEFAULT_CONFIG.general.showNotifications),
      },
      nodes: {
        processTypes: {
          prints: this.coerceBoolean(processTypes.prints, DEFAULT_CONFIG.nodes.processTypes.prints),
          functions: this.coerceBoolean(processTypes.functions, DEFAULT_CONFIG.nodes.processTypes.functions),
          forLoops: this.coerceBoolean(processTypes.forLoops, DEFAULT_CONFIG.nodes.processTypes.forLoops),
          whileLoops: this.coerceBoolean(processTypes.whileLoops, DEFAULT_CONFIG.nodes.processTypes.whileLoops),
          variables: this.coerceBoolean(processTypes.variables, DEFAULT_CONFIG.nodes.processTypes.variables),
          ifs: this.coerceBoolean(processTypes.ifs, DEFAULT_CONFIG.nodes.processTypes.ifs),
          imports: this.coerceBoolean(processTypes.imports, DEFAULT_CONFIG.nodes.processTypes.imports),
          exceptions: this.coerceBoolean(processTypes.exceptions, DEFAULT_CONFIG.nodes.processTypes.exceptions),
        },
      },
      storage: {
        saveFlowcharts: this.coerceBoolean(storage.saveFlowcharts, DEFAULT_CONFIG.storage.saveFlowcharts),
        maxSavedFlowcharts: this.coerceNumber(storage.maxSavedFlowcharts, DEFAULT_CONFIG.storage.maxSavedFlowcharts, 1),
        storageLocation: this.coerceStorageLocation(storage.storageLocation, DEFAULT_CONFIG.storage.storageLocation),
        includeSourceCode: this.coerceBoolean(storage.includeSourceCode, DEFAULT_CONFIG.storage.includeSourceCode),
        autoCleanupDays: this.coerceNumber(storage.autoCleanupDays, DEFAULT_CONFIG.storage.autoCleanupDays, 1),
        export: {
          defaultPngLocation: typeof exportSettings.defaultPngLocation === 'string'
            ? exportSettings.defaultPngLocation
            : DEFAULT_CONFIG.storage.export.defaultPngLocation,
          useCustomPngLocation: this.coerceBoolean(exportSettings.useCustomPngLocation, DEFAULT_CONFIG.storage.export.useCustomPngLocation),
          autoIncrementPngVersions: this.coerceBoolean(exportSettings.autoIncrementPngVersions, DEFAULT_CONFIG.storage.export.autoIncrementPngVersions),
        },
      },
      appearance: {
        theme: this.coerceTheme(appearance.theme, DEFAULT_CONFIG.appearance.theme),
        fontSize: this.coerceNumber(appearance.fontSize, DEFAULT_CONFIG.appearance.fontSize, 8),
        lineHeight: this.coerceNumber(appearance.lineHeight, DEFAULT_CONFIG.appearance.lineHeight, 1),
      },
      performance: {
        maxNodes: this.coerceNumber(performance.maxNodes, DEFAULT_CONFIG.performance.maxNodes, 10),
        timeout: this.coerceNumber(performance.timeout, DEFAULT_CONFIG.performance.timeout, 1000),
      },
    };
  }

  private coerceBoolean(value: unknown, fallback: boolean): boolean {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      const normalized = value.toLowerCase();
      if (normalized === 'true') {
        return true;
      }
      if (normalized === 'false') {
        return false;
      }
    }
    return fallback;
  }

  private coerceNumber(value: unknown, fallback: number, min?: number): number {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }
    if (typeof min === 'number' && parsed < min) {
      return fallback;
    }
    return parsed;
  }

  private coerceTheme(value: unknown, fallback: 'light' | 'dark' | 'auto'): 'light' | 'dark' | 'auto' {
    return value === 'light' || value === 'dark' || value === 'auto' ? value : fallback;
  }

  private coerceStorageLocation(value: unknown, fallback: 'workspace' | 'global'): 'workspace' | 'global' {
    return value === 'workspace' || value === 'global' ? value : fallback;
  }

  /**
   * Notify all change listeners
   */
  private notifyChangeListeners(key: ConfigurationKey, oldValue: any, newValue: any): void {
    const event: ConfigurationChangeEvent = {
      section: key.split('.')[0] as keyof FlowchartConfig,
      key,
      oldValue,
      newValue,
    };
    
    this.changeListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in configuration change listener:', error);
      }
    });
  }
}
