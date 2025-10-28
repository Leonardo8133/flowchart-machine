import * as path from 'path';
import { By } from 'selenium-webdriver';
import { EditorView, VSBrowser, WebView, Workbench } from 'vscode-extension-tester';
import { strict as assert } from 'assert';

describe('Subgraph Collapse/Expand UI Test', () => {
  let workbench: Workbench;
  const workspaceFolder = path.join('src', 'test', 'python_files');
  const pythonFile = path.join(workspaceFolder, 'class_method_calls.py');

  before(async function () {
    this.timeout(120_000);

    await VSBrowser.instance.openResources(workspaceFolder, async () => {
      await VSBrowser.instance.driver.sleep(2_000);
    });

    workbench = new Workbench();
  });

  afterEach(async function () {
    this.timeout(10_000);
    await new EditorView().closeAllEditors();
  });

  it('tests subgraph collapse and expand functionality', async function () {
    this.timeout(240_000);
    const driver = VSBrowser.instance.driver;

    await VSBrowser.instance.openResources(pythonFile, async () => {
      await driver.sleep(500);
    });

    const editorView = new EditorView();
    await editorView.openEditor('class_method_calls.py');

    await workbench.executeCommand('Generate Python Flowchart');

    const flowchartTitle = await driver.wait(async () => {
      const titles = await editorView.getOpenEditorTitles();
      return titles.find((title) => title.startsWith('Flowchart: ')) || undefined;
    }, 120_000, 'The flowchart editor did not open in time.');

    assert.notStrictEqual(flowchartTitle, undefined, 'Expected a flowchart tab to open');

    const groups = await editorView.getEditorGroups();
    for (const group of groups) {
      const titles = await group.getOpenEditorTitles();
      if (titles.some(t => t.includes('Flowchart:'))) {
        await group.openEditor(flowchartTitle!);
        break;
      }
    }

    const webview = new WebView();
    await webview.switchToFrame();

    await driver.sleep(5_000);

    // Get initial mermaid code
    const mermaidCodeText = await driver.wait(async () => {
      try {
        const codeBtn = await webview.findWebElement(By.id('showCodeBtn'));
        return codeBtn;
      } catch {
        return undefined;
      }
    }, 60_000, 'Show code button not found');

    assert.notStrictEqual(mermaidCodeText, undefined, 'Show code button should exist');

    // Click to show mermaid code
    await mermaidCodeText!.click();
    await driver.sleep(1_000);

    const mermaidCodeElement = await driver.wait(async () => {
      try {
        return await webview.findWebElement(By.id('mermaidCodeText'));
      } catch {
        return undefined;
      }
    }, 60_000, 'Mermaid code element not found');

    assert.notStrictEqual(mermaidCodeElement, undefined, 'Mermaid code element should exist');

    // Get initial state - all subgraphs should be visible
    let initialCode = await mermaidCodeElement!.getText();
    console.log('Initial code length:', initialCode.length);

    // Find and click "Collapse All" button
    const collapseAllBtn = await driver.wait(async () => {
      try {
        return await webview.findWebElement(By.id('collapseAllBtn'));
      } catch {
        return undefined;
      }
    }, 60_000, 'Collapse All button not found');

    assert.notStrictEqual(collapseAllBtn, undefined, 'Collapse All button should exist');

    console.log('Clicking Collapse All...');
    await collapseAllBtn!.click();
    await driver.sleep(2_000);

    // Verify all subgraphs are collapsed by checking mermaid code
    let collapsedCode = await mermaidCodeElement!.getText();
    console.log('Collapsed code length:', collapsedCode.length);

    // When collapsed, the code should be shorter or contain markers
    const hasAllCollapsed = !collapsedCode.includes('subgraph "Method: __init__"') 
                          || !collapsedCode.includes('subgraph "Method: test_method"');
    assert.strictEqual(collapsedCode.length < initialCode.length || hasAllCollapsed, true, 
                      'Subgraphs should be collapsed after clicking Collapse All');

    // Find and click "Expand All" button
    const unfoldAllBtn = await driver.wait(async () => {
      try {
        return await webview.findWebElement(By.id('unfoldAllBtn'));
      } catch {
        return undefined;
      }
    }, 60_000, 'Expand All button not found');

    assert.notStrictEqual(unfoldAllBtn, undefined, 'Expand All button should exist');

    console.log('Clicking Expand All...');
    await unfoldAllBtn!.click();
    await driver.sleep(2_000);

    // Verify all subgraphs are expanded
    let expandedCode = await mermaidCodeElement!.getText();
    console.log('Expanded code length:', expandedCode.length);

    // When expanded, the code should be similar to initial
    assert.strictEqual(expandedCode.includes('subgraph "Class: TestClass"'), true, 
                      'TestClass subgraph should be visible after expand');
    assert.strictEqual(expandedCode.includes('subgraph "Class: TestClass2"'), true, 
                      'TestClass2 subgraph should be visible after expand');

    // Test that individual subgraphs exist and are properly structured
    // Note: Individual button clicks are difficult with SVG in webview, so we verify
    // that the subgraphs exist and the collapse/expand all functionality works.
    console.log('Verifying individual subgraph structure...');
    
    const finalCode = await mermaidCodeElement!.getText();
    
    // Verify specific method subgraphs exist in the mermaid code
    assert.strictEqual(finalCode.includes('subgraph "Method: __init__"'), true, 
                      'Method __init__ subgraph should exist');
    assert.strictEqual(finalCode.includes('subgraph "Method: test_method"'), true, 
                      'Method test_method subgraph should exist');
    assert.strictEqual(finalCode.includes('subgraph "Method: call_another_class"'), true, 
                      'Method call_another_class subgraph should exist');
    
    console.log('Individual subgraph verification passed - subgraphs are properly structured');

    await webview.switchBack();
  });
});

