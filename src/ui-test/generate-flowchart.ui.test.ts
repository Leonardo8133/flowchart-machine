import * as path from 'path';
import { By } from 'selenium-webdriver';
import { EditorView, VSBrowser, WebView, Workbench } from 'vscode-extension-tester';
import { strict as assert } from 'assert';

describe('Generate Python Flowchart command (UI)', () => {
  const workbench = new Workbench();
  const workspaceFolder = path.join('src', 'test', 'python_files');
  const pythonFile = path.join(workspaceFolder, 'test_basic.py');

  before(async function () {
    this.timeout(120_000);

    await VSBrowser.instance.openResources(workspaceFolder, async () => {
      // Give VS Code time to load the workspace contents
      await VSBrowser.instance.driver.sleep(3_000);
    });
  });

  afterEach(async () => {
    await new EditorView().closeAllEditors();
  });

  it('opens a flowchart webview for the active Python file', async function () {
    this.timeout(240_000);
    const driver = VSBrowser.instance.driver;

    await VSBrowser.instance.openResources(pythonFile, async () => {
      await driver.sleep(2_000);
    });

    // Make sure the Python file is focused in the editor
    const editorView = new EditorView();
    await editorView.openEditor('test_basic.py');

    await workbench.executeCommand('Generate Python Flowchart');

    // Wait until the flowchart tab appears
    const flowchartTitle = await driver.wait(async () => {
      const titles = await editorView.getOpenEditorTitles();
      return titles.find((title) => title.startsWith('Flowchart: ')) || undefined;
    }, 120_000, 'The flowchart editor did not open in time.');

    assert.notStrictEqual(flowchartTitle, undefined, 'Expected a flowchart tab to open');

    await editorView.openEditor(flowchartTitle!);

    const webview = new WebView();
    await webview.switchToFrame();

    const diagramRoot = await driver.wait(async () => {
      try {
        return await webview.findWebElement(By.css('#mermaidContainer'));
      } catch (error) {
        return undefined;
      }
    }, 60_000, 'Mermaid container not found inside the webview.');

    assert.notStrictEqual(diagramRoot, undefined, 'Mermaid container should exist in the webview');

    await webview.switchBack();
  });
});
