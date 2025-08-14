/**
 * Flowchart Machine Extension - Main Entry Point
 * 
 * This extension helps developers generate visual flowcharts from Python code
 * by executing Python scripts and displaying the results in interactive webviews.
 */

// Export main extension functions
export { activate, deactivate } from './extension';

// Export services
export { PythonService } from './services/pythonService';
export { FileService } from './services/fileService';
export { ConfigService } from './services/configService';
export { StorageService } from './services/storageService';
export type { PythonCheckResult, PythonExecutionResult } from './services/pythonService';
export type { FlowchartOutput } from './services/fileService';

// Export webview components
export { WebviewManager } from './webview/webviewManager';
export { WebviewMessageHandler } from './webview/messageHandler';

// Export commands
export { GenerateFlowchartCommand } from './commands/generateFlowchart';
export { ConfigCommands } from './commands/configCommands';

// Export configuration types
export * from './types/config';

// Export utilities
export * from './utils/helpers';
