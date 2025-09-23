/**
 * Configuration types and interfaces for the Flowchart Machine extension
 */

export interface FlowchartConfig {
  /** General flowchart settings */
  general: GeneralConfig;
  /** Node processing configuration */
  nodes: NodeConfig;
  /** Storage and persistence settings */
  storage: StorageConfig;
  /** Visual appearance settings */
  appearance: AppearanceConfig;
  /** Performance and limits */
  performance: PerformanceConfig;
}

export interface GeneralConfig {
  autoSave: boolean;
  showNotifications: boolean;
}

export interface NodeConfig {
  processTypes: {
    prints: boolean;
    functions: boolean;
    forLoops: boolean;
    whileLoops: boolean;
    variables: boolean;
    ifs: boolean;
    imports: boolean;
    exceptions: boolean;
  };
}

export interface StorageConfig {
  /** Whether to save flowcharts for later use */
  saveFlowcharts: boolean;
  /** Maximum number of saved flowcharts to keep */
  maxSavedFlowcharts: number;
  /** Storage location: 'workspace' or 'global' */
  storageLocation: 'workspace' | 'global';
  /** Whether to include source code with saved flowcharts */
  includeSourceCode: boolean;
  /** Auto-cleanup old flowcharts after days */
  autoCleanupDays: number;
  /** Export settings for PNG files */
  export: {
    /** Default download directory for PNG exports */
    defaultPngLocation: string;
    /** Whether to use custom download location instead of Downloads folder */
    useCustomPngLocation: boolean;
    /** Whether to auto-increment version numbers for PNG files */
    autoIncrementPngVersions: boolean;
  };
}

export interface AppearanceConfig {
  theme: 'light' | 'dark' | 'auto';
  fontSize: number;
  lineHeight: number;
}

export interface PerformanceConfig {
  maxNodes: number;
  timeout: number;
}

export interface SavedFlowchart {
  /** Unique identifier */
  id: string;
  /** Original file path */
  sourceFile: string;
  /** Generated flowchart data */
  flowchart: {
    mermaidCode: string;
    metadata: FlowchartMetadata;
  };
  /** Creation timestamp */
  createdAt: Date;
  /** Last accessed timestamp */
  lastAccessed: Date;
  /** User-defined tags for organization */
  tags: string[];
  /** User notes about this flowchart */
  notes?: string;
}

export interface FlowchartMetadata {
  /** Number of nodes in the flowchart */
  nodeCount: number;
  /** Types of nodes present */
  nodeTypes: string[];
  /** File size of source */
  sourceFileSize: number;
  /** Processing time in milliseconds */
  processingTime: number;
  /** Python script version used */
  scriptVersion?: string;
  /** Extension version that generated this */
  extensionVersion: string;
}

export interface ConfigurationChangeEvent {
  /** The configuration section that changed */
  section: keyof FlowchartConfig;
  /** The specific key that changed */
  key: string;
  /** Previous value */
  oldValue: any;
  /** New value */
  newValue: any;
}

export type ConfigurationKey = 
  | 'general.autoSave'
  | 'general.showNotifications'
  | 'storage.saveFlowcharts'
  | 'storage.maxSavedFlowcharts'
  | 'storage.storageLocation'
  | 'storage.includeSourceCode'
  | 'storage.autoCleanupDays'
  | 'storage.export.defaultPngLocation'
  | 'storage.export.useCustomPngLocation'
  | 'storage.export.autoIncrementPngVersions'
  | 'appearance.theme'
  | 'appearance.fontSize'
  | 'appearance.lineHeight'
  | 'nodes.processTypes.prints'
  | 'nodes.processTypes.functions'
  | 'nodes.processTypes.forLoops'
  | 'nodes.processTypes.whileLoops'
  | 'nodes.processTypes.variables'
  | 'nodes.processTypes.ifs'
  | 'nodes.processTypes.imports'
  | 'nodes.processTypes.exceptions'
  | 'performance.maxNodes'
  | 'performance.timeout';
