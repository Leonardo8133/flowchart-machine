import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
  files: 'out/test/**/*.test.js',
  version: '1.99.3',
  workspaceFolder: './test-workspace',
  mocha: {
    ui: 'tdd',
    timeout: 30000,
    color: true
  },
  launchArgs: [
    '--disable-extensions',
    '--extensionDevelopmentPath=.',
    // extensionTestsPath is auto-detected by test-cli, no need to specify explicitly
  ]
});
