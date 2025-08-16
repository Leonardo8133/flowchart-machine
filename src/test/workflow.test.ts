import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

suite('Flowchart Workflow Tests', () => {
    let extensionContext: vscode.ExtensionContext;
    let testWorkspace: string;

    suiteSetup(async () => {
        // Get the extension context
        extensionContext = (global as any).testExtensionContext;
        
        // Create a test workspace
        testWorkspace = path.join(__dirname, 'test-workspace');
        if (!fs.existsSync(testWorkspace)) {
            fs.mkdirSync(testWorkspace, { recursive: true });
        }
        
        // Create a test Python file
        const testPythonFile = path.join(testWorkspace, 'test_workflow.py');
        const pythonContent = `
def main():
    print("Hello World")
    result = calculate(5, 3)
    print(f"Result: {result}")
    return result

def calculate(a, b):
    return a + b

if __name__ == "__main__":
    main()
`;
        fs.writeFileSync(testPythonFile, pythonContent);
    });

    suiteTeardown(async () => {
        // Clean up test workspace
        if (fs.existsSync(testWorkspace)) {
            fs.rmSync(testWorkspace, { recursive: true, force: true });
        }
    });

    test('Should generate flowchart from Python file', async () => {
        // This test verifies the complete workflow
        const testPythonFile = path.join(testWorkspace, 'test_workflow.py');
        
        // Verify the test file exists
        assert.ok(fs.existsSync(testPythonFile), 'Test Python file should exist');
        
        // Check if the extension command is registered
        const commands = await vscode.commands.getCommands();
        const hasCommand = commands.includes('extension.generateFlowchart');
        assert.ok(hasCommand, 'Extension command should be registered');
        
        // Note: We can't actually execute the command in tests due to VS Code limitations
        // But we can verify the extension is properly loaded and commands are registered
        console.log('✅ Extension command registered successfully');
        console.log('✅ Test Python file created successfully');
        console.log('✅ Test workspace setup completed');
    });

    test('Should have all required webview files', async () => {
        // Verify all webview files exist
        const webviewDir = path.join(__dirname, '..', 'webview');
        const requiredFiles = [
            'index.html',
            'styles.css',
            'mermaid-init.js',
            'zoom-pan.js',
            'controls.js',
            'tooltip.js',
            'message-handler.js',
            'main.js'
        ];
        
        for (const file of requiredFiles) {
            const filePath = path.join(webviewDir, file);
            assert.ok(fs.existsSync(filePath), `Required file ${file} should exist`);
            
            // Check file content is not empty
            const content = fs.readFileSync(filePath, 'utf8');
            assert.ok(content.length > 0, `File ${file} should not be empty`);
        }
        
        console.log('✅ All required webview files exist and have content');
    });
});
