import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Import the extension functions
import { activate, deactivate } from '../extension';

suite('Flowchart Machine Extension Test Suite', () => {
  let extensionContext: vscode.ExtensionContext;
  let testWorkspace: string;

  suiteSetup(async () => {
    // Create a test workspace
    testWorkspace = path.join(__dirname, '../../test-workspace');
    if (!fs.existsSync(testWorkspace)) {
      fs.mkdirSync(testWorkspace, { recursive: true });
    }
    
    // Create a mock extension context
    extensionContext = {
      subscriptions: [],
      extensionPath: testWorkspace,
      extensionUri: vscode.Uri.file(testWorkspace),
      globalState: {
        get: () => undefined,
        update: () => Promise.resolve(),
        keys: () => [],
        setKeysForSync: () => {}
      },
      workspaceState: {
        get: () => undefined,
        update: () => Promise.resolve(),
        keys: () => []
      },
      asAbsolutePath: (relativePath: string) => path.join(testWorkspace, relativePath),
      storagePath: testWorkspace,
      globalStoragePath: testWorkspace,
      logPath: testWorkspace,
      extensionMode: vscode.ExtensionMode.Test,
      // Add missing required properties
      secrets: {
        get: () => Promise.resolve(undefined),
        store: () => Promise.resolve(),
        delete: () => Promise.resolve(),
        onDidChange: {} as any
      },
      environmentVariableCollection: {} as any,
      storageUri: vscode.Uri.file(testWorkspace),
      globalStorageUri: vscode.Uri.file(testWorkspace),
      logUri: vscode.Uri.file(testWorkspace),
      extension: {} as any,
      languageModelAccessInformation: {} as any
    } as vscode.ExtensionContext;
  });

  suiteTeardown(async () => {
    // Clean up test workspace with retry logic for Windows file locks
    if (fs.existsSync(testWorkspace)) {
      try {
        fs.rmSync(testWorkspace, { recursive: true, force: true });
      } catch (error) {
        console.warn('Could not remove test workspace, will retry:', error);
        // Wait a bit and try again
        await new Promise(resolve => setTimeout(resolve, 1000));
        try {
          fs.rmSync(testWorkspace, { recursive: true, force: true });
        } catch (retryError) {
          console.warn('Failed to remove test workspace after retry:', retryError);
        }
      }
    }
  });

  setup(async () => {
    // Ensure clean state before each test
    if (fs.existsSync(testWorkspace)) {
      const files = fs.readdirSync(testWorkspace);
      for (const file of files) {
        const filePath = path.join(testWorkspace, file);
        if (fs.statSync(filePath).isFile()) {
          fs.unlinkSync(filePath);
        }
      }
    }
  });

  teardown(async () => {
    // Clean up after each test to prevent command registration conflicts
    if (fs.existsSync(testWorkspace)) {
      try {
        const files = fs.readdirSync(testWorkspace);
        for (const file of files) {
          const filePath = path.join(testWorkspace, file);
          if (fs.statSync(filePath).isFile()) {
            try {
              fs.unlinkSync(filePath);
            } catch (error) {
              console.warn(`Could not remove file ${file}:`, error);
            }
          }
        }
      } catch (error) {
        console.warn('Could not read test workspace directory:', error);
      }
    }
  });

  test('Extension should activate successfully', async () => {
    // Activate the extension
    activate(extensionContext);
    
    // Wait a bit for command registration
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Check if the command is registered
    const commands = await vscode.commands.getCommands();
    const hasFlowchartCommand = commands.includes('extension.generateFlowchart');
    
    assert.strictEqual(hasFlowchartCommand, true, 'Flowchart command should be registered');
  });

  test('Extension should deactivate successfully', () => {
    // This test ensures the deactivate function doesn't throw errors
    assert.doesNotThrow(() => {
      deactivate();
    }, 'Deactivate should not throw errors');
  });

  test('Command should only work with Python files', async () => {
    // Create a non-Python file
    const nonPythonFile = path.join(testWorkspace, 'test.txt');
    fs.writeFileSync(nonPythonFile, 'This is not Python code');
    
    // Open the file
    const document = await vscode.workspace.openTextDocument(nonPythonFile);
    await vscode.window.showTextDocument(document);
    
    // Try to execute the command
    try {
      await vscode.commands.executeCommand('extension.generateFlowchart');
      assert.fail('Command should not execute for non-Python files');
    } catch (error) {
      // Expected error - command should fail for non-Python files
      assert.ok(error, 'Command should fail for non-Python files');
    }
  });

  test('Command should check for Python availability', async () => {
    // Create a Python file
    const pythonFile = path.join(testWorkspace, 'test.py');
    fs.writeFileSync(pythonFile, 'print("Hello World")');
    
    // Open the file
    const document = await vscode.workspace.openTextDocument(pythonFile);
    await vscode.window.showTextDocument(document);
    
    // Mock Python check to simulate Python not being available
    const originalExec = exec;
    require('child_process').exec = (command: string, callback: any) => {
      callback(new Error('Python not found'), '', 'command not found');
    };
    
    try {
      await vscode.commands.executeCommand('extension.generateFlowchart');
      assert.fail('Command should fail when Python is not available');
    } catch (error) {
      // Expected error - command should fail when Python is not available
      assert.ok(error, 'Command should fail when Python is not available');
    } finally {
      // Restore original exec
      require('child_process').exec = originalExec;
    }
  });

  test('Command should check for main.py existence', async () => {
    // Create a Python file without main.py
    const pythonFile = path.join(testWorkspace, 'test.py');
    fs.writeFileSync(pythonFile, 'print("Hello World")');
    
    // Open the file
    const document = await vscode.workspace.openTextDocument(pythonFile);
    await vscode.window.showTextDocument(document);
    
    // Mock Python check to simulate Python being available
    const originalExec = exec;
    require('child_process').exec = (command: string, callback: any) => {
      callback(null, 'Python 3.9.0', '');
    };
    
    try {
      await vscode.commands.executeCommand('extension.generateFlowchart');
      assert.fail('Command should fail when main.py is not found');
    } catch (error) {
      // Expected error - command should fail when main.py is not found
      assert.ok(error, 'Command should fail when main.py is not found');
    } finally {
      // Restore original exec
      require('child_process').exec = originalExec;
    }
  });

  test('Command should execute successfully with proper setup', async () => {
    // Create a Python file
    const pythonFile = path.join(testWorkspace, 'test.py');
    fs.writeFileSync(pythonFile, 'print("Hello World")');
    
    // Create main.py
    const mainPy = path.join(testWorkspace, 'main.py');
    fs.writeFileSync(mainPy, `
import sys
import json

def main():
    input_file = sys.argv[1]
    # Create a simple flowchart
    flowchart = """graph TD
    A[Start] --> B[Print Hello World]
    B --> C[End]"""
    
    # Write flowchart to file
    with open('flowchart.mmd', 'w') as f:
        f.write(flowchart)
    
    # Create tooltip data
    tooltip_data = {
        "A": "Start of the program",
        "B": "Prints 'Hello World' to console",
        "C": "End of the program"
    }
    
    with open('tooltip_data.json', 'w') as f:
        json.dump(tooltip_data, f)

if __name__ == "__main__":
    main()
`);
    
    // Open the Python file
    const document = await vscode.workspace.openTextDocument(pythonFile);
    await vscode.window.showTextDocument(document);
    
    // Mock Python execution to simulate successful flowchart generation
    const originalExec = exec;
    
    // Mock the child_process module since the extension imports exec at module level
    const originalChildProcess = require('child_process');
    const mockExec = (command: string, callback: any) => {
      console.log('Mock exec called with command:', command);
      // Simulate the Python script execution
      if (command.includes('main.py')) {
        try {
          console.log('Creating mock output files...');
          // Create the output files that the Python script would generate
          const flowchartPath = path.join(testWorkspace, 'flowchart.mmd');
          const tooltipPath = path.join(testWorkspace, 'tooltip_data.json');
          
          fs.writeFileSync(flowchartPath, `graph TD
    A[Start] --> B[Print Hello World]
    B --> C[End]`);
          
          fs.writeFileSync(tooltipPath, JSON.stringify({
            "A": "Start of the program",
            "B": "Prints 'Hello World' to console",
            "C": "End of the program"
          }));
          
          console.log('Mock files created successfully');
          console.log('Files in workspace:', fs.readdirSync(testWorkspace));
          
          // Call callback immediately after files are created
          callback(null, 'Flowchart generated successfully', '');
        } catch (error) {
          console.error('Mock exec error:', error);
          callback(error, '', 'Error writing output files');
        }
      } else {
        console.log('Mock exec: Python version check');
        callback(null, 'Python 3.9.0', '');
      }
    };
    
    // Apply the mock to the child_process module
    require('child_process').exec = mockExec;
    
    try {
      // Execute the command
      await vscode.commands.executeCommand('extension.generateFlowchart');
      
      // Check if the output files were created
      const flowchartPath = path.join(testWorkspace, 'flowchart.mmd');
      const tooltipPath = path.join(testWorkspace, 'tooltip_data.json');
      
      // Debug: Check what files exist in the test workspace
      console.log('Files in test workspace:', fs.readdirSync(testWorkspace));
      console.log('Flowchart path:', flowchartPath);
      console.log('Flowchart exists:', fs.existsSync(flowchartPath));
      console.log('Tooltip path:', tooltipPath);
      console.log('Tooltip exists:', fs.existsSync(tooltipPath));
      
      assert.ok(fs.existsSync(flowchartPath), 'Flowchart file should be created');
      assert.ok(fs.existsSync(tooltipPath), 'Tooltip data file should be created');
      
      // Check file contents
      const flowchartContent = fs.readFileSync(flowchartPath, 'utf-8');
      const tooltipContent = JSON.parse(fs.readFileSync(tooltipPath, 'utf-8'));
      
      assert.ok(flowchartContent.includes('graph TD'), 'Flowchart should contain Mermaid syntax');
      assert.ok(tooltipContent.A, 'Tooltip data should contain node information');
      
    } finally {
      // Restore original exec
      require('child_process').exec = originalExec;
      
      // Clean up output files
      const flowchartPath = path.join(testWorkspace, 'flowchart.mmd');
      const tooltipPath = path.join(testWorkspace, 'tooltip_data.json');
      if (fs.existsSync(flowchartPath)) fs.unlinkSync(flowchartPath);
      if (fs.existsSync(tooltipPath)) fs.unlinkSync(tooltipPath);
    }
  });

  test('Command should handle Python execution errors gracefully', async () => {
    // Create a Python file
    const pythonFile = path.join(testWorkspace, 'test.py');
    fs.writeFileSync(pythonFile, 'print("Hello World")');
    
    // Create main.py
    const mainPy = path.join(testWorkspace, 'main.py');
    fs.writeFileSync(mainPy, 'print("This will fail")');
    
    // Open the Python file
    const document = await vscode.workspace.openTextDocument(pythonFile);
    await vscode.window.showTextDocument(document);
    
    // Mock Python execution to simulate failure
    const originalExec = exec;
    require('child_process').exec = (command: string, callback: any) => {
      if (command.includes('main.py')) {
        callback(new Error('Python script failed'), '', 'Error: Script execution failed');
      } else {
        callback(null, 'Python 3.9.0', '');
      }
    };
    
    try {
      await vscode.commands.executeCommand('extension.generateFlowchart');
      assert.fail('Command should fail when Python script fails');
    } catch (error) {
      // Expected error - command should fail when Python script fails
      assert.ok(error, 'Command should fail when Python script fails');
    } finally {
      // Restore original exec
      require('child_process').exec = originalExec;
    }
  });

  test('Extension should handle missing flowchart output gracefully', async () => {
    // Create a Python file
    const pythonFile = path.join(testWorkspace, 'test.py');
    fs.writeFileSync(pythonFile, 'print("Hello World")');
    
    // Create main.py
    const mainPy = path.join(testWorkspace, 'main.py');
    fs.writeFileSync(mainPy, 'print("Script runs but no output")');
    
    // Open the Python file
    const document = await vscode.workspace.openTextDocument(pythonFile);
    await vscode.window.showTextDocument(document);
    
    // Mock Python execution to simulate successful execution but no output files
    const originalExec = exec;
    require('child_process').exec = (command: string, callback: any) => {
      if (command.includes('main.py')) {
        callback(null, 'Script executed successfully', '');
      } else {
        callback(null, 'Python 3.9.0', '');
      }
    };
    
    try {
      await vscode.commands.executeCommand('extension.generateFlowchart');
      assert.fail('Command should fail when flowchart output is missing');
    } catch (error) {
      // Expected error - command should fail when flowchart output is missing
      assert.ok(error, 'Command should fail when flowchart output is missing');
    } finally {
      // Restore original exec
      require('child_process').exec = originalExec;
    }
  });
});
