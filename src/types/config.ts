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
  /** Whether to automatically save flowcharts after generation */
  autoSave: boolean;
  /** Default output format for flowcharts */
  defaultFormat: 'mermaid' | 'svg' | 'png';
  /** Whether to show progress notifications */
  showProgress: boolean;
  /** Whether to open webview automatically after generation */
  autoOpenWebview: boolean;
}

export interface NodeConfig {
  /** Types of nodes to process */
  processTypes: {
    /** Process function definitions */
    functions: boolean;
    /** Process function calls */
    functionCalls: boolean;
    /** Process variable assignments */
    assignments: boolean;
    /** Process print statements */
    prints: boolean;
    /** Process loops (for, while) */
    loops: boolean;
    /** Process conditional statements (if, elif, else) */
    conditionals: boolean;
    /** Process return statements */
    returns: boolean;
    /** Process import statements */
    imports: boolean;
    /** Process class definitions */
    classes: boolean;
    /** Process exception handling (try, except, finally) */
    exceptions: boolean;
  };
  /** Maximum depth for nested structures */
  maxDepth: number;
  /** Whether to include comments in node labels */
  includeComments: boolean;
  /** Whether to show line numbers in nodes */
  showLineNumbers: boolean;
  /** Custom node labels for specific patterns */
  customLabels: Record<string, string>;
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
  /** Whether to include tooltip data with saved flowcharts */
  includeTooltipData: boolean;
  /** Auto-cleanup old flowcharts after days */
  autoCleanupDays: number;
}

export interface AppearanceConfig {
  /** Default theme for flowcharts */
  theme: 'default' | 'dark' | 'light' | 'custom';
  /** Custom CSS for flowchart styling */
  customCSS: string;
  /** Node colors for different types */
  nodeColors: {
    functions: string;
    calls: string;
    assignments: string;
    prints: string;
    loops: string;
    conditionals: string;
    returns: string;
    imports: string;
    classes: string;
    exceptions: string;
  };
  /** Font family for flowchart text */
  fontFamily: string;
  /** Font size for flowchart text */
  fontSize: number;
  /** Whether to use rounded corners for nodes */
  roundedCorners: boolean;
  /** Node spacing and layout */
  layout: {
    nodeSpacing: number;
    rankSpacing: number;
    direction: 'TB' | 'BT' | 'LR' | 'RL';
  };
}

export interface PerformanceConfig {
  /** Maximum number of nodes per flowchart */
  maxNodes: number;
  /** Maximum file size to process (in KB) */
  maxFileSize: number;
  /** Whether to use parallel processing for large files */
  parallelProcessing: boolean;
  /** Timeout for Python script execution (in seconds) */
  scriptTimeout: number;
  /** Whether to cache parsed results */
  enableCaching: boolean;
  /** Cache expiration time (in hours) */
  cacheExpirationHours: number;
}

export interface SavedFlowchart {
  /** Unique identifier */
  id: string;
  /** Original file path */
  sourceFile: string;
  /** Generated flowchart data */
  flowchart: {
    mermaidCode: string;
    tooltipData: any;
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
  | 'general.defaultFormat'
  | 'general.showProgress'
  | 'general.autoOpenWebview'
  | 'nodes.processTypes.functions'
  | 'nodes.processTypes.functionCalls'
  | 'nodes.processTypes.assignments'
  | 'nodes.processTypes.prints'
  | 'nodes.processTypes.loops'
  | 'nodes.processTypes.conditionals'
  | 'nodes.processTypes.returns'
  | 'nodes.processTypes.imports'
  | 'nodes.processTypes.classes'
  | 'nodes.processTypes.exceptions'
  | 'nodes.maxDepth'
  | 'nodes.includeComments'
  | 'nodes.showLineNumbers'
  | 'storage.saveFlowcharts'
  | 'storage.maxSavedFlowcharts'
  | 'storage.storageLocation'
  | 'storage.includeSourceCode'
  | 'storage.includeTooltipData'
  | 'storage.autoCleanupDays'
  | 'appearance.theme'
  | 'appearance.customCSS'
  | 'appearance.fontFamily'
  | 'appearance.fontSize'
  | 'appearance.roundedCorners'
  | 'performance.maxNodes'
  | 'performance.maxFileSize'
  | 'performance.parallelProcessing'
  | 'performance.scriptTimeout'
  | 'performance.enableCaching'
  | 'performance.cacheExpirationHours';
