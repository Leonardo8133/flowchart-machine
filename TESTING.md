# Testing Guide for Flowchart Machine Extension

This document provides comprehensive information about testing the Flowchart Machine extension.

## 🧪 Test Structure

The extension has two main test suites:

### 1. **Extension Tests** (`src/test/extension.test.ts`)
Tests the core extension functionality:
- Extension activation/deactivation
- Command registration
- File validation
- Python availability checking
- Command execution scenarios
- Error handling

### 2. **Webview Tests** (`src/test/webview.test.ts`)
Tests the webview functionality:
- HTML structure validation
- Mermaid diagram handling
- Message communication
- Container management
- Tooltip functionality

## 🚀 Running Tests

### Prerequisites
- Node.js and npm installed
- VS Code Extension Development Host
- All dependencies installed (`npm install`)

### Quick Test Commands

#### Using npm scripts:
```bash
# Run all tests
npm test

# Run only unit tests
npm run test

# Run linter
npm run lint

# Compile TypeScript
npm run compile

# Run all checks (compile + lint + test)
npm run pretest
```

#### Using test scripts:
```bash
# On Unix/Linux/macOS:
./scripts/test.sh [unit|lint|compile|all|help]

# On Windows:
scripts\test.bat [unit|lint|compile|all|help]
```

#### Using VS Code:
1. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS)
2. Type "Run Extension Tests"
3. Select the test configuration

## 📋 Test Categories

### Unit Tests
- **Extension Lifecycle**: Activation, deactivation, command registration
- **File Validation**: Python file detection, main.py existence
- **Python Integration**: Availability checking, execution simulation
- **Error Handling**: Graceful failure scenarios

### Integration Tests
- **Command Execution**: End-to-end command flow
- **File Generation**: Flowchart and tooltip file creation
- **Webview Communication**: Message passing between extension and webview

### Webview Tests
- **HTML Structure**: Proper DOM element creation
- **Mermaid Integration**: Diagram rendering and validation
- **Message Handling**: Command processing and response
- **Container Management**: Dynamic container replacement

## 🔧 Test Configuration

### Test Workspaces
Tests create temporary workspaces in:
- `test-workspace/` - For extension tests
- `test-workspace-webview/` - For webview tests

### Mocking Strategy
- **File System**: Temporary files created and cleaned up
- **Python Execution**: `exec` function mocked for controlled testing
- **VS Code API**: Mock extension context and workspace

### Test Data
- Sample Python files with various content
- Mock `main.py` scripts for flowchart generation
- Expected output files (temp/flowchart.mmd, temp/tooltip_data.json)

## 📊 Test Coverage

### Current Coverage Areas
✅ Extension activation and command registration  
✅ File type validation (Python only)  
✅ Python availability checking  
✅ main.py existence validation  
✅ Successful flowchart generation  
✅ Error handling for Python failures  
✅ Missing output file handling  
✅ Webview HTML structure  
✅ Mermaid diagram processing  
✅ Message command handling  
✅ Tooltip data validation  
✅ Container replacement logic  

### Areas for Future Testing
🔄 Webview message communication (requires VS Code Extension Host)  
🔄 Mermaid rendering in actual webview  
🔄 User interaction with tooltips  
🔄 Regeneration button functionality  
🔄 Progress indicator display  

## 🐛 Debugging Tests

### Common Issues

#### 1. **Tests fail to compile**
```bash
# Ensure TypeScript is compiled
npm run compile

# Check for syntax errors
npm run lint
```

#### 2. **Extension context errors**
- Verify mock extension context is properly structured
- Check that all required properties are mocked

#### 3. **File system permission errors**
- Ensure test workspaces can be created/deleted
- Check file permissions in test directories

#### 4. **Python mocking issues**
- Verify `exec` function is properly mocked
- Check that mock callbacks are called correctly

### Debug Mode
Run tests in debug mode using VS Code:
1. Set breakpoints in test files
2. Use "Run Extension Tests" configuration
3. Step through test execution

## 📝 Writing New Tests

### Test Structure
```typescript
test('Test description', async () => {
  // Arrange - Set up test data and mocks
  
  // Act - Execute the function being tested
  
  // Assert - Verify expected outcomes
});
```

### Best Practices
1. **Isolation**: Each test should be independent
2. **Cleanup**: Always clean up test files and mocks
3. **Descriptive names**: Test names should clearly describe what's being tested
4. **Mocking**: Mock external dependencies for controlled testing
5. **Assertions**: Use specific assertions with clear error messages

### Example Test
```typescript
test('Command should validate Python file extension', async () => {
  // Arrange
  const nonPythonFile = path.join(testWorkspace, 'test.txt');
  fs.writeFileSync(nonPythonFile, 'Not Python code');
  
  // Act & Assert
  try {
    await vscode.commands.executeCommand('extension.generateFlowchart');
    assert.fail('Command should fail for non-Python files');
  } catch (error) {
    assert.ok(error, 'Expected error for non-Python files');
  }
});
```

## 🔍 Continuous Integration

### GitHub Actions (Recommended)
```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run pretest
```

### Pre-commit Hooks
```json
{
  "husky": {
    "hooks": {
      "pre-commit": "npm run pretest"
    }
  }
}
```

## 📚 Additional Resources

- [VS Code Extension Testing Guide](https://code.visualstudio.com/api/working-with-extensions/testing-extension)
- [Mocha Testing Framework](https://mochajs.org/)
- [Node.js Assert Module](https://nodejs.org/api/assert.html)
- [TypeScript Testing Best Practices](https://www.typescriptlang.org/docs/handbook/testing.html)

## 🤝 Contributing Tests

When adding new features, please:
1. Write tests for the new functionality
2. Ensure existing tests still pass
3. Update this documentation if needed
4. Follow the established testing patterns

---

**Note**: Some tests require the VS Code Extension Development Host to run properly. These tests may fail when run outside of VS Code but will work correctly in the extension development environment.
