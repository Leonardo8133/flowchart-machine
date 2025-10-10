import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Activation Smoke Test', () => {
  test('Extension activates and registers commands', async () => {
    const ext = vscode.extensions.getExtension('LeonardoSouza.flowchart-machine');
    assert.ok(ext, 'Extension should be found by ID');

    if (!ext!.isActive) {
      await ext!.activate();
    }

    const cmds = await vscode.commands.getCommands(true);
    assert.ok(cmds.includes('extension.generateFlowchart'));
    assert.ok(cmds.includes('extension.generateFlowchartAtCursor'));
  });
});


