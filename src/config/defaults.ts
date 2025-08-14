import { FlowchartConfig } from '../types/config';

/**
 * Default configuration values for the Flowchart Machine extension
 */
export const DEFAULT_CONFIG: FlowchartConfig = {
  general: {
    autoSave: true,
    defaultFormat: 'mermaid',
    showProgress: true,
    autoOpenWebview: true,
  },
  nodes: {
    processTypes: {
      functions: true,
      functionCalls: true,
      assignments: true,
      prints: true,
      loops: true,
      conditionals: true,
      returns: true,
      imports: false, // Usually not needed for flowcharts
      classes: true,
      exceptions: true,
    },
    maxDepth: 5,
    includeComments: false,
    showLineNumbers: true,
    customLabels: {
      'print': 'Output',
      'return': 'Return Value',
      'import': 'Import Module',
    },
  },
  storage: {
    saveFlowcharts: true,
    maxSavedFlowcharts: 50,
    storageLocation: 'workspace',
    includeSourceCode: true,
    includeTooltipData: true,
    autoCleanupDays: 30,
  },
  appearance: {
    theme: 'default',
    customCSS: '',
    nodeColors: {
      functions: '#4CAF50',
      calls: '#2196F3',
      assignments: '#FF9800',
      prints: '#9C27B0',
      loops: '#F44336',
      conditionals: '#E91E63',
      returns: '#00BCD4',
      imports: '#607D8B',
      classes: '#795548',
      exceptions: '#FF5722',
    },
    fontFamily: 'var(--vscode-font-family)',
    fontSize: 14,
    roundedCorners: true,
    layout: {
      nodeSpacing: 50,
      rankSpacing: 100,
      direction: 'TB',
    },
  },
  performance: {
    maxNodes: 100,
    maxFileSize: 1024, // 1MB
    parallelProcessing: false,
    scriptTimeout: 30,
    enableCaching: true,
    cacheExpirationHours: 24,
  },
};

/**
 * Configuration schema for VS Code settings
 */
export const CONFIG_SCHEMA = {
  'flowchartMachine.general.autoSave': {
    type: 'boolean',
    default: DEFAULT_CONFIG.general.autoSave,
    description: 'Automatically save flowcharts after generation',
  },
  'flowchartMachine.general.defaultFormat': {
    type: 'string',
    enum: ['mermaid', 'svg', 'png'],
    default: DEFAULT_CONFIG.general.defaultFormat,
    description: 'Default output format for flowcharts',
  },
  'flowchartMachine.general.showProgress': {
    type: 'boolean',
    default: DEFAULT_CONFIG.general.showProgress,
    description: 'Show progress notifications during generation',
  },
  'flowchartMachine.general.autoOpenWebview': {
    type: 'boolean',
    default: DEFAULT_CONFIG.general.autoOpenWebview,
    description: 'Automatically open webview after generation',
  },
  'flowchartMachine.nodes.processTypes.functions': {
    type: 'boolean',
    default: DEFAULT_CONFIG.nodes.processTypes.functions,
    description: 'Process function definitions',
  },
  'flowchartMachine.nodes.processTypes.functionCalls': {
    type: 'boolean',
    default: DEFAULT_CONFIG.nodes.processTypes.functionCalls,
    description: 'Process function calls',
  },
  'flowchartMachine.nodes.processTypes.assignments': {
    type: 'boolean',
    default: DEFAULT_CONFIG.nodes.processTypes.assignments,
    description: 'Process variable assignments',
  },
  'flowchartMachine.nodes.processTypes.prints': {
    type: 'boolean',
    default: DEFAULT_CONFIG.nodes.processTypes.prints,
    description: 'Process print statements',
  },
  'flowchartMachine.nodes.processTypes.loops': {
    type: 'boolean',
    default: DEFAULT_CONFIG.nodes.processTypes.loops,
    description: 'Process loops (for, while)',
  },
  'flowchartMachine.nodes.processTypes.conditionals': {
    type: 'boolean',
    default: DEFAULT_CONFIG.nodes.processTypes.conditionals,
    description: 'Process conditional statements',
  },
  'flowchartMachine.nodes.processTypes.returns': {
    type: 'boolean',
    default: DEFAULT_CONFIG.nodes.processTypes.returns,
    description: 'Process return statements',
  },
  'flowchartMachine.nodes.processTypes.imports': {
    type: 'boolean',
    default: DEFAULT_CONFIG.nodes.processTypes.imports,
    description: 'Process import statements',
  },
  'flowchartMachine.nodes.processTypes.classes': {
    type: 'boolean',
    default: DEFAULT_CONFIG.nodes.processTypes.classes,
    description: 'Process class definitions',
  },
  'flowchartMachine.nodes.processTypes.exceptions': {
    type: 'boolean',
    default: DEFAULT_CONFIG.nodes.processTypes.exceptions,
    description: 'Process exception handling',
  },
  'flowchartMachine.nodes.maxDepth': {
    type: 'number',
    minimum: 1,
    maximum: 20,
    default: DEFAULT_CONFIG.nodes.maxDepth,
    description: 'Maximum depth for nested structures',
  },
  'flowchartMachine.nodes.includeComments': {
    type: 'boolean',
    default: DEFAULT_CONFIG.nodes.includeComments,
    description: 'Include comments in node labels',
  },
  'flowchartMachine.nodes.showLineNumbers': {
    type: 'boolean',
    default: DEFAULT_CONFIG.nodes.showLineNumbers,
    description: 'Show line numbers in nodes',
  },
  'flowchartMachine.storage.saveFlowcharts': {
    type: 'boolean',
    default: DEFAULT_CONFIG.storage.saveFlowcharts,
    description: 'Save flowcharts for later use',
  },
  'flowchartMachine.storage.maxSavedFlowcharts': {
    type: 'number',
    minimum: 1,
    maximum: 1000,
    default: DEFAULT_CONFIG.storage.maxSavedFlowcharts,
    description: 'Maximum number of saved flowcharts to keep',
  },
  'flowchartMachine.storage.storageLocation': {
    type: 'string',
    enum: ['workspace', 'global'],
    default: DEFAULT_CONFIG.storage.storageLocation,
    description: 'Storage location for saved flowcharts',
  },
  'flowchartMachine.storage.includeSourceCode': {
    type: 'boolean',
    default: DEFAULT_CONFIG.storage.includeSourceCode,
    description: 'Include source code with saved flowcharts',
  },
  'flowchartMachine.storage.includeTooltipData': {
    type: 'boolean',
    default: DEFAULT_CONFIG.storage.includeTooltipData,
    description: 'Include tooltip data with saved flowcharts',
  },
  'flowchartMachine.storage.autoCleanupDays': {
    type: 'number',
    minimum: 1,
    maximum: 365,
    default: DEFAULT_CONFIG.storage.autoCleanupDays,
    description: 'Auto-cleanup old flowcharts after days',
  },
  'flowchartMachine.appearance.theme': {
    type: 'string',
    enum: ['default', 'dark', 'light', 'custom'],
    default: DEFAULT_CONFIG.appearance.theme,
    description: 'Default theme for flowcharts',
  },
  'flowchartMachine.appearance.customCSS': {
    type: 'string',
    default: DEFAULT_CONFIG.appearance.customCSS,
    description: 'Custom CSS for flowchart styling',
  },
  'flowchartMachine.appearance.fontFamily': {
    type: 'string',
    default: DEFAULT_CONFIG.appearance.fontFamily,
    description: 'Font family for flowchart text',
  },
  'flowchartMachine.appearance.fontSize': {
    type: 'number',
    minimum: 8,
    maximum: 32,
    default: DEFAULT_CONFIG.appearance.fontSize,
    description: 'Font size for flowchart text',
  },
  'flowchartMachine.appearance.roundedCorners': {
    type: 'boolean',
    default: DEFAULT_CONFIG.appearance.roundedCorners,
    description: 'Use rounded corners for nodes',
  },
  'flowchartMachine.performance.maxNodes': {
    type: 'number',
    minimum: 10,
    maximum: 1000,
    default: DEFAULT_CONFIG.performance.maxNodes,
    description: 'Maximum number of nodes per flowchart',
  },
  'flowchartMachine.performance.maxFileSize': {
    type: 'number',
    minimum: 100,
    maximum: 10000,
    default: DEFAULT_CONFIG.performance.maxFileSize,
    description: 'Maximum file size to process (in KB)',
  },
  'flowchartMachine.performance.parallelProcessing': {
    type: 'boolean',
    default: DEFAULT_CONFIG.performance.parallelProcessing,
    description: 'Use parallel processing for large files',
  },
  'flowchartMachine.performance.scriptTimeout': {
    type: 'number',
    minimum: 5,
    maximum: 300,
    default: DEFAULT_CONFIG.performance.scriptTimeout,
    description: 'Timeout for Python script execution (in seconds)',
  },
  'flowchartMachine.performance.enableCaching': {
    type: 'boolean',
    default: DEFAULT_CONFIG.performance.enableCaching,
    description: 'Cache parsed results for better performance',
  },
  'flowchartMachine.performance.cacheExpirationHours': {
    type: 'number',
    minimum: 1,
    maximum: 168,
    default: DEFAULT_CONFIG.performance.cacheExpirationHours,
    description: 'Cache expiration time (in hours)',
  },
};
