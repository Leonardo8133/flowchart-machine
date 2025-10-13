import * as path from 'path';
import Mocha from 'mocha';

export function run(): Promise<void> {
  // Create the mocha test
  const mocha = new Mocha({
    ui: 'tdd',
    color: true,
    timeout: 30000 // 30 seconds for longer-running tests
  });

  const testsRoot = path.resolve(__dirname, '..');

  return new Promise((resolve, reject) => {
    try {
      mocha.addFile(path.resolve(testsRoot, 'generate_command.test.ts'));
      mocha.addFile(path.resolve(testsRoot, 'connection_view_fallback.test.ts'));

      // Run the mocha test
      mocha.run((failures: any) => {
        if (failures > 0) {
          reject(new Error(`${failures} tests failed.`));
        } else {
          resolve();
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}
