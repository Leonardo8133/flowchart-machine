# 🔧 Flowchart Machine Configuration Guide

The Flowchart Machine extension now includes a comprehensive configuration system that allows you to customize every aspect of flowchart generation, storage, and appearance.

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [Configuration Categories](#configuration-categories)
- [Settings Reference](#settings-reference)
- [Commands Reference](#commands-reference)
- [Storage Management](#storage-management)
- [Examples](#examples)

## 🚀 Quick Start

### 1. **Open Settings (Recommended)**
- Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
- Type "Open Flowchart Machine Settings"
- Select the command to open VS Code settings
- **This is the main way to configure the extension**

### 2. **Alternative: Direct Settings Access**
- Press `Ctrl+,` (or `Cmd+,` on Mac) to open VS Code settings
- Search for "flowchartMachine" to see all available options
- All settings are organized in logical categories

## 🎯 Configuration Categories

### **General Settings**
Control basic extension behavior:
- **Auto Save**: Automatically save flowcharts after generation
- **Default Format**: Choose output format (mermaid, svg, png)
- **Show Progress**: Display progress notifications
- **Auto Open Webview**: Automatically open webview after generation

### **Node Processing**
Configure which Python code elements to process:
- **Functions**: Function definitions
- **Function Calls**: Function invocations
- **Assignments**: Variable assignments
- **Prints**: Print statements
- **Loops**: For and while loops
- **Conditionals**: If/elif/else statements
- **Returns**: Return statements
- **Imports**: Import statements
- **Classes**: Class definitions
- **Exceptions**: Try/except/finally blocks

### **Storage Settings**
Manage flowchart persistence:
- **Save Flowcharts**: Enable/disable automatic saving
- **Max Saved**: Maximum number of flowcharts to keep
- **Storage Location**: Workspace or global storage
- **Include Source Code**: Save original Python code
- **Include Tooltip Data**: Save detailed node information
- **Auto Cleanup**: Remove old flowcharts automatically

### **Appearance Settings**
Customize flowchart visual appearance:
- **Theme**: Choose from default, dark, light, or custom
- **Custom CSS**: Add your own styling
- **Node Colors**: Set colors for different node types
- **Font Settings**: Customize text appearance
- **Layout**: Control spacing and direction

### **Performance Settings**
Optimize extension performance:
- **Max Nodes**: Limit nodes per flowchart
- **Max File Size**: Maximum file size to process
- **Parallel Processing**: Enable for large files
- **Script Timeout**: Python execution timeout
- **Caching**: Enable result caching
- **Cache Expiration**: How long to keep cached results

## ⚙️ Settings Reference

### **General Settings**
```json
{
  "flowchartMachine.general.autoSave": true,
  "flowchartMachine.general.defaultFormat": "mermaid",
  "flowchartMachine.general.showProgress": true,
  "flowchartMachine.general.autoOpenWebview": true
}
```

### **Node Processing**
```json
{
  "flowchartMachine.nodes.processTypes.functions": true,
  "flowchartMachine.nodes.processTypes.functionCalls": true,
  "flowchartMachine.nodes.processTypes.assignments": true,
  "flowchartMachine.nodes.processTypes.prints": true,
  "flowchartMachine.nodes.processTypes.loops": true,
  "flowchartMachine.nodes.processTypes.conditionals": true,
  "flowchartMachine.nodes.processTypes.returns": true,
  "flowchartMachine.nodes.processTypes.imports": false,
  "flowchartMachine.nodes.processTypes.classes": true,
  "flowchartMachine.nodes.processTypes.exceptions": true,
  "flowchartMachine.nodes.maxDepth": 5,
  "flowchartMachine.nodes.includeComments": false,
  "flowchartMachine.nodes.showLineNumbers": true
}
```

### **Storage Settings**
```json
{
  "flowchartMachine.storage.saveFlowcharts": true,
  "flowchartMachine.storage.maxSavedFlowcharts": 50,
  "flowchartMachine.storage.storageLocation": "workspace",
  "flowchartMachine.storage.includeSourceCode": true,
  "flowchartMachine.storage.includeTooltipData": true,
  "flowchartMachine.storage.autoCleanupDays": 30
}
```

### **Appearance Settings**
```json
{
  "flowchartMachine.appearance.theme": "default",
  "flowchartMachine.appearance.customCSS": "",
  "flowchartMachine.appearance.fontFamily": "var(--vscode-font-family)",
  "flowchartMachine.appearance.fontSize": 14,
  "flowchartMachine.appearance.roundedCorners": true
}
```

### **Performance Settings**
```json
{
  "flowchartMachine.performance.maxNodes": 100,
  "flowchartMachine.performance.maxFileSize": 1024,
  "flowchartMachine.performance.parallelProcessing": false,
  "flowchartMachine.performance.scriptTimeout": 30,
  "flowchartMachine.performance.enableCaching": true,
  "flowchartMachine.performance.cacheExpirationHours": 24
}
```

## 🎮 Commands Reference

### **Available Commands**
| Command | Description |
|---------|-------------|
| `extension.generateFlowchart` | Generate Python flowchart (main feature) |
| `flowchartMachine.config.openSettings` | Open VS Code settings for the extension |

### **Configuration Access**
All configuration options are available through the VS Code settings UI:
- **Press `Ctrl+Shift+P`** → "Open Flowchart Machine Settings"
- **Or press `Ctrl+,`** and search for "flowchartMachine"

### **Internal Functionality**
The extension still provides all the advanced features internally:
- **Automatic flowchart saving** (when enabled)
- **Storage management** with auto-cleanup
- **Performance optimization** based on your settings
- **Custom appearance** and node processing options

*Note: Advanced features are configured through settings rather than individual commands to keep the command palette clean.*

## 💾 Storage Management

### **Storage Locations**
- **Workspace**: Flowcharts saved in `.flowchart-machine/` folder within your project
- **Global**: Flowcharts saved in your user directory

### **Auto-Cleanup**
- Automatically removes old flowcharts based on your settings
- Runs every hour in the background
- Respects your `maxSavedFlowcharts` and `autoCleanupDays` settings

### **Export/Import**
- **Export**: Save all flowcharts to a single JSON file
- **Import**: Restore flowcharts from an export file
- Useful for sharing flowcharts between workspaces or backing up

### **Storage Statistics**
View detailed information about your stored flowcharts:
- Total count and size
- Creation and access dates
- Most used tags
- Node type distribution

## 📝 Examples

### **Example 1: Focus on Functions Only**
```json
{
  "flowchartMachine.nodes.processTypes.functions": true,
  "flowchartMachine.nodes.processTypes.functionCalls": false,
  "flowchartMachine.nodes.processTypes.assignments": false,
  "flowchartMachine.nodes.processTypes.prints": false,
  "flowchartMachine.nodes.processTypes.loops": false,
  "flowchartMachine.nodes.processTypes.conditionals": false,
  "flowchartMachine.nodes.processTypes.returns": true,
  "flowchartMachine.nodes.processTypes.imports": false,
  "flowchartMachine.nodes.processTypes.classes": false,
  "flowchartMachine.nodes.processTypes.exceptions": false
}
```

### **Example 2: High-Performance Settings**
```json
{
  "flowchartMachine.performance.maxNodes": 500,
  "flowchartMachine.performance.maxFileSize": 5000,
  "flowchartMachine.performance.parallelProcessing": true,
  "flowchartMachine.performance.scriptTimeout": 60,
  "flowchartMachine.performance.enableCaching": true,
  "flowchartMachine.performance.cacheExpirationHours": 48
}
```

### **Example 3: Custom Appearance**
```json
{
  "flowchartMachine.appearance.theme": "custom",
  "flowchartMachine.appearance.customCSS": "
    .mermaid { 
      background: #1e1e1e; 
      border-radius: 8px; 
      padding: 20px; 
    }
    .mermaid .node { 
      stroke-width: 2px; 
      font-weight: bold; 
    }
  ",
  "flowchartMachine.appearance.fontSize": 16,
  "flowchartMachine.appearance.roundedCorners": true
}
```

### **Example 4: Minimal Storage**
```json
{
  "flowchartMachine.storage.saveFlowcharts": false,
  "flowchartMachine.storage.maxSavedFlowcharts": 10,
  "flowchartMachine.storage.autoCleanupDays": 7,
  "flowchartMachine.storage.includeSourceCode": false,
  "flowchartMachine.storage.includeTooltipData": false
}
```

## 🔍 Troubleshooting

### **Common Issues**

1. **Configuration Not Saving**
   - Check if you have workspace settings enabled
   - Try using global settings instead

2. **Flowcharts Not Being Saved**
   - Verify `flowchartMachine.storage.saveFlowcharts` is `true`
   - Check storage location permissions

3. **Performance Issues**
   - Reduce `maxNodes` and `maxFileSize` values
   - Enable caching for repeated operations

4. **Storage Cleanup Not Working**
   - Check `autoCleanupDays` setting
   - Manually run cleanup command

### **Reset to Defaults**
If you encounter issues, you can always reset to defaults:
1. `Ctrl+Shift+P` → "Reset Flowchart Machine Configuration to Defaults"
2. Confirm the action
3. Restart VS Code if needed

## 📚 Advanced Usage

### **Configuration Change Listeners**
The extension automatically detects configuration changes and updates behavior in real-time. No restart required!

### **Workspace vs Global Settings**
- **Workspace**: Settings specific to your current project
- **Global**: Settings applied to all VS Code instances
- Use workspace settings for project-specific configurations
- Use global settings for personal preferences

### **Custom CSS Styling**
Add your own CSS to customize flowchart appearance:
```json
{
  "flowchartMachine.appearance.customCSS": "
    .mermaid { 
      box-shadow: 0 4px 8px rgba(0,0,0,0.3); 
    }
    .mermaid .node { 
      transition: all 0.3s ease; 
    }
    .mermaid .node:hover { 
      transform: scale(1.05); 
    }
  "
}
```

## 🎉 Conclusion

The Flowchart Machine configuration system gives you complete control over:
- **What gets processed** (node types, depth limits)
- **How it looks** (themes, colors, fonts)
- **Where it's stored** (workspace/global, cleanup policies)
- **Performance tuning** (timeouts, caching, file limits)

Start with the defaults and gradually customize to match your workflow. The extension will remember your preferences and apply them automatically to all future flowchart generations.

For questions or issues, check the VS Code extension marketplace or create an issue in the project repository.
