import { FlowchartConfig } from '../types/config';

/**
 * Default configuration values for the Flowchart Machine extension
 */
export const DEFAULT_CONFIG: FlowchartConfig = {
  general: {
    autoSave: true,
    showNotifications: true,
  },
  nodes: {
    processTypes: {
      prints: true,
      functions: true,
      forLoops: true,
      whileLoops: true,
      variables: true,
      ifs: true,
      imports: true,
      exceptions: true,
    },
  },
  connectionView: {
    inboundDepth: 3,
    outboundDepth: 4,
  },
  storage: {
    saveFlowcharts: true,
    maxSavedFlowcharts: 50,
    storageLocation: 'workspace',
    includeSourceCode: true,
    autoCleanupDays: 30,
    export: {
      defaultPngLocation: '',
      useCustomPngLocation: false,
      autoIncrementPngVersions: true,
    },
  },
  appearance: {
    theme: 'auto',
    fontSize: 12,
    lineHeight: 1.2,
  },
  performance: {
    maxNodes: 1000,
    timeout: 30000,
  },
};

/**
 * Configuration schema for VS Code settings
 */
export const CONFIG_SCHEMA = {
  'flowchartMachine.general.autoSave': {
    type: 'boolean',
    default: DEFAULT_CONFIG.general.autoSave,
    description: 'Automatically save flowcharts',
  },
  'flowchartMachine.general.showNotifications': {
    type: 'boolean',
    default: DEFAULT_CONFIG.general.showNotifications,
    description: 'Show notifications for operations',
  },
  'flowchartMachine.nodes.processTypes.prints': {
    type: 'boolean',
    default: DEFAULT_CONFIG.nodes.processTypes.prints,
    description: 'Show print statements in the flowchart',
  },
  'flowchartMachine.nodes.processTypes.functions': {
    type: 'boolean',
    default: DEFAULT_CONFIG.nodes.processTypes.functions,
    description: 'Show function definitions in the flowchart',
  },
  'flowchartMachine.nodes.processTypes.forLoops': {
    type: 'boolean',
    default: DEFAULT_CONFIG.nodes.processTypes.forLoops,
    description: 'Show for loops in the flowchart',
  },
  'flowchartMachine.nodes.processTypes.whileLoops': {
    type: 'boolean',
    default: DEFAULT_CONFIG.nodes.processTypes.whileLoops,
    description: 'Show while loops in the flowchart',
  },
  'flowchartMachine.nodes.processTypes.variables': {
    type: 'boolean',
    default: DEFAULT_CONFIG.nodes.processTypes.variables,
    description: 'Show variable assignments in the flowchart',
  },
  'flowchartMachine.nodes.processTypes.ifs': {
    type: 'boolean',
    default: DEFAULT_CONFIG.nodes.processTypes.ifs,
    description: 'Show if statements in the flowchart',
  },
  'flowchartMachine.nodes.processTypes.imports': {
    type: 'boolean',
    default: DEFAULT_CONFIG.nodes.processTypes.imports,
    description: 'Show import statements in the flowchart',
  },
  'flowchartMachine.nodes.processTypes.exceptions': {
    type: 'boolean',
    default: DEFAULT_CONFIG.nodes.processTypes.exceptions,
    description: 'Show exception handling in the flowchart',
  },
  'flowchartMachine.connectionView.inboundDepth': {
    type: 'number',
    minimum: 0,
    maximum: 5,
    default: DEFAULT_CONFIG.connectionView.inboundDepth,
    description: 'Maximum caller depth to include in connection view',
  },
  'flowchartMachine.connectionView.outboundDepth': {
    type: 'number',
    minimum: 0,
    maximum: 6,
    default: DEFAULT_CONFIG.connectionView.outboundDepth,
    description: 'Maximum callee depth to include in connection view',
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
  'flowchartMachine.storage.autoCleanupDays': {
    type: 'number',
    minimum: 1,
    maximum: 365,
    default: DEFAULT_CONFIG.storage.autoCleanupDays,
    description: 'Auto-cleanup old flowcharts after days',
  },
  'flowchartMachine.storage.export.defaultPngLocation': {
    type: 'string',
    default: DEFAULT_CONFIG.storage.export.defaultPngLocation,
    description: 'Default location for PNG exports',
  },
  'flowchartMachine.storage.export.useCustomPngLocation': {
    type: 'boolean',
    default: DEFAULT_CONFIG.storage.export.useCustomPngLocation,
    description: 'Use custom location for PNG exports',
  },
  'flowchartMachine.storage.export.autoIncrementPngVersions': {
    type: 'boolean',
    default: DEFAULT_CONFIG.storage.export.autoIncrementPngVersions,
    description: 'Automatically increment version numbers for PNG files',
  },
  'flowchartMachine.appearance.theme': {
    type: 'string',
    enum: ['light', 'dark', 'auto'],
    default: DEFAULT_CONFIG.appearance.theme,
    description: 'Theme for the flowchart display',
  },
  'flowchartMachine.appearance.fontSize': {
    type: 'number',
    minimum: 8,
    maximum: 24,
    default: DEFAULT_CONFIG.appearance.fontSize,
    description: 'Font size for flowchart text',
  },
  'flowchartMachine.appearance.lineHeight': {
    type: 'number',
    minimum: 1.0,
    maximum: 2.0,
    default: DEFAULT_CONFIG.appearance.lineHeight,
    description: 'Line height for flowchart text',
  },
  'flowchartMachine.performance.maxNodes': {
    type: 'number',
    minimum: 10,
    maximum: 10000,
    default: DEFAULT_CONFIG.performance.maxNodes,
    description: 'Maximum number of nodes allowed in a flowchart',
  },
  'flowchartMachine.performance.timeout': {
    type: 'number',
    minimum: 1000,
    maximum: 60000,
    default: DEFAULT_CONFIG.performance.timeout,
    description: 'Timeout for flowchart generation in milliseconds',
  },
};
