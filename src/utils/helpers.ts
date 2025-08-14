/**
 * Common utility functions and constants for the Flowchart Machine extension
 */

export const EXTENSION_ID = 'extension.generateFlowchart';
export const COMMAND_TITLE = 'Generate Python Flowchart';
export const COMMAND_CATEGORY = 'Flowchart';

/**
 * Delay execution for a specified number of milliseconds
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if a value is defined and not null
 */
export function isDefined<T>(value: T | undefined | null): value is T {
  return value !== undefined && value !== null;
}

/**
 * Safely get a property from an object
 */
export function safeGet<T>(obj: any, key: string, defaultValue: T): T {
  return obj && typeof obj === 'object' && key in obj ? obj[key] : defaultValue;
}

/**
 * Format error messages for user display
 */
export function formatErrorMessage(error: any): string {
  if (typeof error === 'string') {
    return error;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * Validate file extension
 */
export function isValidFileExtension(filePath: string, validExtensions: string[]): boolean {
  const extension = filePath.split('.').pop()?.toLowerCase();
  return extension ? validExtensions.includes(extension) : false;
}

/**
 * Sanitize file path for display
 */
export function sanitizeFilePath(filePath: string): string {
  // Remove any potentially dangerous characters for display
  return filePath.replace(/[<>:"|?*]/g, '_');
}

/**
 * Generate a unique identifier
 */
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}
