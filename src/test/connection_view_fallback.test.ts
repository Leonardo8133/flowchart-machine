import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

import { ConnectionViewService } from '../services/connectionViewService';

suite('Connection View Fallback', () => {
  const testWorkspace = path.join(__dirname, 'connection-workspace');
  const sourceDir = path.join(__dirname, 'python_files', 'connection_fallback');
  let originalFolders: readonly vscode.WorkspaceFolder[] | undefined;

  suiteSetup(async () => {
    if (fs.existsSync(testWorkspace)) {
      fs.rmSync(testWorkspace, { recursive: true, force: true });
    }
    fs.mkdirSync(testWorkspace, { recursive: true });

    for (const entry of fs.readdirSync(sourceDir)) {
      const srcPath = path.join(sourceDir, entry);
      const destPath = path.join(testWorkspace, entry);
      fs.copyFileSync(srcPath, destPath);
    }

    originalFolders = vscode.workspace.workspaceFolders;
    const folderUri = vscode.Uri.file(testWorkspace);
    vscode.workspace.updateWorkspaceFolders(0, originalFolders ? originalFolders.length : 0, {
      uri: folderUri,
      name: 'ConnectionFallback'
    });

    // Allow the workspace change to propagate
    await new Promise(resolve => setTimeout(resolve, 250));
  });

  suiteTeardown(() => {
    const currentCount = vscode.workspace.workspaceFolders?.length ?? 0;
    vscode.workspace.updateWorkspaceFolders(0, currentCount);

    if (originalFolders && originalFolders.length > 0) {
      vscode.workspace.updateWorkspaceFolders(0, 0, ...originalFolders.map(folder => ({ uri: folder.uri, name: folder.name })));
    }

    if (fs.existsSync(testWorkspace)) {
      fs.rmSync(testWorkspace, { recursive: true, force: true });
    }
  });

  test('builds diagram when call hierarchy is unavailable', async () => {
    const service = new ConnectionViewService();
    const mainPath = path.join(testWorkspace, 'main.py');
    const document = await vscode.workspace.openTextDocument(mainPath);
    await vscode.window.showTextDocument(document);

    const lines = document.getText().split(/\r?\n/);
    const startLineIndex = lines.findIndex(line => line.includes('def start('));
    assert.ok(startLineIndex >= 0, 'start function should exist in the test file');

    const metadata = {
      entry_selection: {
        type: 'function',
        name: 'start',
        line_offset: { start: startLineIndex + 1 }
      }
    };

    const originalExecute = vscode.commands.executeCommand;
    (vscode.commands.executeCommand as any) = async (command: string, ...args: any[]) => {
      if (
        command === 'vscode.prepareCallHierarchy' ||
        command === 'vscode.provideCallHierarchyOutgoingCalls' ||
        command === 'vscode.provideCallHierarchyIncomingCalls'
      ) {
        throw new Error('Call hierarchy unavailable');
      }
      return originalExecute.call(vscode.commands, command, ...args);
    };

    try {
      const result = await service.createFromMetadata(mainPath, metadata);
      assert.ok(result, 'Result should not be null');
      assert.ok(result?.metadata.hasData, 'Fallback should produce data');
      assert.ok(result?.diagram.includes('main.py'));
      assert.ok(result?.diagram.includes('helper.py'));
      assert.ok(result?.diagram.includes('caller.py'));
    } finally {
      (vscode.commands.executeCommand as any) = originalExecute;
    }
  });
});
