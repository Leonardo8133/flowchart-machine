import * as vscode from 'vscode';
import { exec } from 'child_process';

export interface PythonCheckResult {
  available: boolean;
  error?: string;
}

export interface PythonExecutionResult {
  success: boolean;
  stdout?: string;
  stderr?: string;
  error?: string;
}

export class PythonService {
  /**
   * Check if Python is available on the system
   */
  static async checkAvailability(): Promise<PythonCheckResult> {
    return new Promise((resolve) => {
      exec('python --version', (error, stdout, stderr) => {
        if (error) {
          // Try python3 as fallback
          exec('python3 --version', (error2, stdout2, stderr2) => {
            if (error2) {
              resolve({
                available: false,
                error: 'Neither python nor python3 command found. Please install Python and ensure it\'s in your PATH.'
              });
            } else {
              resolve({ available: true });
            }
          });
        } else {
          resolve({ available: true });
        }
      });
    });
  }

  /**
   * Execute a Python script with arguments
   */
  static async executeScript(scriptPath: string, args: string[]): Promise<PythonExecutionResult> {
    return new Promise((resolve) => {
      const command = `python "${scriptPath}" ${args.map(arg => `"${arg}"`).join(' ')}`;
      
      exec(command, (error, stdout, stderr) => {
        if (error) {
          resolve({
            success: false,
            error: error.message,
            stderr: stderr
          });
        } else {
          resolve({
            success: true,
            stdout: stdout,
            stderr: stderr
          });
        }
      });
    });
  }

  /**
   * Validate that a Python script exists and is accessible
   */
  static validateScriptPath(scriptPath: string): boolean {
    const fs = require('fs');
    return fs.existsSync(scriptPath);
  }
}
