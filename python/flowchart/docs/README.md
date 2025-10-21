# Flowchart Processor Documentation

## Overview

The Flowchart Processor is a Python-based tool that analyzes Python code and generates interactive Mermaid JS flowcharts. It visualizes code execution flow, including control structures, function calls, class hierarchies, and method interactions.

## Quick Start

```python
from main import FlowchartGenerator

# Generate flowchart from Python code
generator = FlowchartGenerator()
mermaid_output, metadata = generator.generate_from_code(python_code_string)
```

## Architecture

The processor follows a three-stage pipeline:

```
Python Code → Processor → Post-Processor → Mermaid Output
```

### 1. **Entry Processor** (`entry_processor.py`)
- Handles entry point selection (file, function, class, or method)
- Extracts relevant code snippets based on entry type
- Creates line mappings for accurate source tracking

### 2. **Core Processor** (`processor/processor.py`)
- Parses Python code using the `ast` module
- Uses the Strategy Pattern with dedicated handlers for each node type
- Tracks scopes, types, and connections
- Generates nodes and connections

### 3. **Post-Processor** (`post_processor.py`)
- Creates subgraphs for classes, methods, and functions
- Handles subgraph collapsing based on size and configuration
- Optimizes connections and removes redundant nodes
- Applies collapse priority rules

## Key Concepts

### Nodes
Nodes represent individual statements or operations in your code. Each node has:
- **ID**: Unique identifier (e.g., `if_cond5`, `assign3`)
- **Text**: Human-readable description of the operation
- **Shape**: Visual representation in Mermaid (diamond for conditions, rectangle for processes, etc.)
- **Scope**: Hierarchical context (main flow, function, class, method)

### Connections
Connections show the flow of execution between nodes:
- **Standard** (`-->`): Sequential flow
- **Bidirectional** (`<-->`): Method calls with "Call and Return" semantics
- **Labeled**: Connections with descriptive labels (e.g., "True", "False", "uses")

### Scopes
Scopes organize nodes hierarchically:
- **Main flow**: Top-level code (no scope)
- **Function**: `functionName`
- **Class**: `class_ClassName`
- **Method**: `class_ClassName_methodName`

### Subgraphs
Subgraphs group related nodes visually:
- **Classes**: Contain all methods as nested subgraphs
- **Methods**: Show internal implementation within class subgraphs
- **Functions**: Can be collapsed if too large
- **Collapsible**: Large subgraphs can be collapsed to a single node

## Documentation Index

### Core Features
- **[Node Types](NODE_TYPES.md)** - Complete reference of all 26+ node handlers
- **[Connections & Flow](CONNECTIONS.md)** - How execution flow is represented
- **[Subgraphs](SUBGRAPHS.md)** - Class and method organization

### Advanced Topics
- **[Entry Points](ENTRY_POINTS.md)** - Controlling what code is visualized
- **[Type Tracking](TYPE_TRACKING.md)** - How the processor resolves method calls
- **[Configuration](CONFIGURATION.md)** - Environment variables and display options
- **[Advanced Features](ADVANCED_FEATURES.md)** - Recursion, breakpoints, and special handling

### Reference
- **[Collapse Priority](COLLAPSE_PRIORITY.md)** - Subgraph collapse rules
- **[Machine-Readable Schema](schema.json)** - JSON schema for programmatic access
- **[Clarifications](CLARIFICATIONS_NEEDED.md)** - Known edge cases and questions

## Common Use Cases

### Visualize Entire File
```bash
export ENTRY_TYPE=file
python main.py input.py
```

### Focus on Specific Function
```bash
export ENTRY_TYPE=function
export ENTRY_NAME=my_function
python main.py input.py
```

### Analyze Class Method
```bash
export ENTRY_TYPE=class
export ENTRY_CLASS=MyClass
export ENTRY_NAME=my_method
python main.py input.py
```

### Hide Verbose Output
```bash
export SHOW_PRINTS=0
export SHOW_VARIABLES=0
python main.py input.py
```

## Output Format

The processor generates:

1. **Mermaid JS Code**: Text representation of the flowchart
   ```
   graph TD
       start1[Start]
       if_cond2{"if x > 0"}
       print3["print(`Positive`)"]
       start1 --> if_cond2
       if_cond2 -->|True| print3
   ```

2. **Metadata**: JSON object with:
   - Collapsed subgraphs information
   - Whitelist and force collapse lists
   - Available subgraphs
   - Node counts

## Design Patterns

### Strategy Pattern
Each AST node type has a dedicated handler class:
```python
handlers = {
    ast.If: IfHandler(self),
    ast.For: ForHandler(self),
    ast.Return: ReturnHandler(self),
    # ... 20+ more handlers
}
```

### Scope Tracking
Every node knows its execution context:
```python
self.node_scopes[node_id] = scope  # e.g., "class_Calculator_add"
```

### Type Resolution
Variables, parameters, and attributes are tracked to resolve method calls:
```python
self.variable_types = {'obj': 'MyClass'}
self.parameter_types = {'class_MyClass___init__': {'db': 'Database'}}
self.attribute_types = {'class_Service': {'db': 'Database'}}
```

## Best Practices

1. **Use Entry Points** - Focus on specific functions or classes for clearer diagrams
2. **Configure Display** - Hide unnecessary details (prints, variables) for high-level views
3. **Leverage Collapse** - Use whitelist/force collapse for large codebases
4. **Set Breakpoints** - Highlight specific lines during debugging
5. **Check Metadata** - Use the metadata output to understand what's been collapsed

## Contributing

When adding new features:
1. Create a dedicated handler class if adding new node type support
2. Update the corresponding documentation file
3. Add test cases in `tests/test_examples/`
4. Update `schema.json` with new node types or features

## Version

Documentation Version: 1.0
Processor Version: Compatible with Python 3.8+

