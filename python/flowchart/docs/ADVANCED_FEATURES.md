# Advanced Features

## Overview

The flowchart processor includes several advanced features for handling complex code patterns, preventing infinite loops, and providing debugging aids.

---

## Recursion Detection

### Purpose

Detect and visualize recursive function calls without creating infinite flowcharts.

### How It Works

**Detection Logic**:
```python
def _is_recursive_call(self, func_name, current_scope):
    """Check if a function call is recursive (calling itself)."""
    return func_name == current_scope
```

When a function calls itself, instead of expanding infinitely, a **loop back** is created.

### Example

**Code**:
```python
def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n-1)
```

**Flowchart**:
```mermaid
subgraph "Function: factorial"
    method_factorial1[["Method: factorial(n)"]]
    if_cond2{"if n <= 1"}
    return3["return 1"]
    return4["return n * factorial(n-1)"]
    
    method_factorial1 --> if_cond2
    if_cond2 -->|True| return3
    if_cond2 -->|False| return4
    return4 --> method_factorial1  # Loop back to start
end
```

**Key Points**:
1. Recursive call detected: `factorial(n-1)` while in `factorial` scope
2. Connection loops back to function start instead of creating new subgraph
3. Prevents infinite node creation

### Tracking

**Function Start Nodes**:
```python
self.function_start_nodes = {
    'factorial': 'method_factorial1',
    'fibonacci': 'method_fibonacci5'
}
```

**Recursive Call Tracking**:
```python
self.recursive_calls = {
    'factorial': ['return4'],  # Node IDs that loop back
    'fibonacci': ['return8', 'return9']
}
```

---

## Nesting Depth Limits

### Purpose

Prevent excessive call stack visualization and performance issues.

### Configuration

**Default Limit**: `MAX_NESTING_DEPTH = 6`

**Environment Variable**:
```bash
export MAX_NESTING_DEPTH=3
```

### How It Works

The processor tracks **current nesting depth**:

```python
self.current_nesting_depth = 0  # Increments with each function call

def _is_nesting_limit_exceeded(self):
    return self.current_nesting_depth >= FlowchartConfig.MAX_NESTING_DEPTH
```

**When Exceeded**:
```python
# In ExprHandler:
if self.processor._is_nesting_limit_exceeded():
    # Create placeholder node
    call_id = self.processor._generate_id(f"nesting_limit_{func_name}")
    text = f"Call: {func_name}() (Max nesting depth {MAX_NESTING_DEPTH} exceeded)"
    self.processor._add_node(call_id, text, shape=SHAPES['function_call'], scope=scope)
    return call_id  # Don't expand function body
```

### Example

**Code**:
```python
def level1():
    level2()

def level2():
    level3()

def level3():
    level4()

def level4():
    level5()

level1()
```

**With MAX_NESTING_DEPTH=3**:
```mermaid
level1 subgraph:
    level2 call

level2 subgraph:
    level3 call

level3 subgraph:
    level4[["Call: level4() (Max nesting depth 3 exceeded)"]]
    # level4 body NOT expanded
```

**Prevents**:
- Deep recursion visualization issues
- Performance degradation
- Excessively large flowcharts

---

## Node Consolidation

### Purpose

Merge consecutive simple nodes to reduce visual clutter.

### Configuration

**Environment Variable**:
```bash
export MERGE_COMMON_NODES=1  # Default: on
export MERGE_COMMON_NODES=0  # Disable merging
```

### Eligible Nodes

**Can Be Consolidated**:
- Print statements
- Simple assignments (no function calls)
- Augmented assignments (+=, -=, etc.)

**Cannot Be Consolidated**:
- Control flow nodes (if, for, while)
- Function/method calls
- Return statements
- Nodes in different scopes

### Consolidation Logic

**In NodeHandler**:
```python
def _should_consolidate_with_previous(self, prev_id, scope):
    if not self.processor.merge_common_nodes:
        return False
    
    if not prev_id or prev_id not in self.processor.nodes:
        return False
    
    prev_scope = self.processor.node_scopes.get(prev_id)
    if prev_scope != scope:
        return False  # Different scopes
    
    prev_node_def = self.processor.nodes[prev_id]
    
    # Don't consolidate with control flow
    if any(keyword in prev_node_def for keyword in ['if', 'for', 'while', 'Call:', 'return']):
        return False
    
    # Check if previous is print or simple assignment
    if 'print(' in prev_node_def or self._is_simple_assignment(prev_node_def):
        return True
    
    return False
```

### Example

**Code**:
```python
x = 5
y = 10
z = 15
print(x)
print(y)
```

**With MERGE_COMMON_NODES=1**:
```mermaid
assign1["x = 5\ny = 10\nz = 15\nprint(x)\nprint(y)"]
```

**With MERGE_COMMON_NODES=0**:
```mermaid
assign1["x = 5"]
assign2["y = 10"]
assign3["z = 15"]
print4["print(x)"]
print5["print(y)"]
```

### Use Cases

**Enable (default)**: Clean, compact flowcharts for high-level understanding

**Disable**: Detailed step-by-step execution visualization

---

## Breakpoint Highlighting

### Purpose

Highlight specific lines of code in the flowchart for debugging.

### Configuration

```bash
export HAS_BREAKPOINTS=1
export BREAKPOINT_LINES='10,25,42,55'
```

### How It Works

**1. Loading Breakpoints**:
```python
# In processor.py __init__:
if os.getenv('HAS_BREAKPOINTS') == '1':
    breakpoint_str = os.getenv('BREAKPOINT_LINES', '')
    if breakpoint_str:
        self.breakpoint_lines = set(int(line) for line in breakpoint_str.split(','))
```

**2. Checking Nodes**:
```python
def _should_highlight_breakpoint(self, node):
    return node and hasattr(node, 'lineno') and node.lineno in self.breakpoint_lines
```

**3. Adding Prefix**:
```python
# In _add_node:
if self._should_highlight_breakpoint(self.last_added_node):
    text = f"🔴 {text}" if text != " " else ""
```

### Example

**Code** (`example.py`):
```python
def calculate(x):
    if x > 0:
        result = x * 2  # Line 3
        return result   # Line 4
    return 0

value = calculate(5)    # Line 7
```

**Command**:
```bash
export HAS_BREAKPOINTS=1
export BREAKPOINT_LINES='3,7'
python main.py example.py
```

**Flowchart**:
```mermaid
assign1["🔴 result = x * 2"]  # Highlighted
return2["return result"]
assign3["🔴 value = calculate(5)"]  # Highlighted
```

### Use Cases

- **Debugging**: Highlight lines where bugs occur
- **Code Review**: Draw attention to specific changes
- **Documentation**: Emphasize important lines

---

## Error and Warning Nodes

### Purpose

Show errors and warnings when code patterns can't be properly resolved or are incorrect.

### Node Types

#### 1. Method Not Found

**When Created**: Method called but doesn't exist in class

**Text**: `❌ Method 'method_name' not found in ClassName`

**Example**:
```python
class User:
    def get_name(self):
        return self.name

user = User()
user.delete()  # Method doesn't exist
```

**Flowchart**:
```mermaid
error1[["❌ Method 'delete' not found in User"]]
```

---

#### 2. Class Not Resolved

**When Created**: Method called but object's class can't be determined

**Text**: `❌ Could not resolve class for method 'method_name'`

**Example**:
```python
obj = get_unknown_object()
obj.method()  # obj's type unknown
```

**Flowchart**:
```mermaid
error2[["❌ Could not resolve class for method 'method'"]]
```

---

#### 3. Property Not Found

**When Created**: Property accessed but doesn't exist in class

**Text**: `❌ Property 'property_name' not found in ClassName`

**Example**:
```python
class User:
    def __init__(self, name):
        self.name = name

user = User("John")
print(user.age)  # age doesn't exist
```

**Flowchart**:
```mermaid
error3[["❌ Property 'age' not found in User"]]
```

---

#### 4. Property Called as Method

**When Created**: Property accessed with call syntax `()`

**Text**: `⚠️ 'property_name' is a property, not a method`

**Example**:
```python
class User:
    def __init__(self, name):
        self.name = name

user = User("John")
user.name()  # name is a property, not a method
```

**Flowchart**:
```mermaid
warning4[["⚠️ 'name' is a property, not a method"]]
```

---

#### 5. Redundant __init__ Call

**When Created**: Explicit `__init__` call after instantiation

**Text**: `⚠️ Redundant __init__ call: ClassName() already calls constructor`

**Example**:
```python
class MyClass:
    def __init__(self):
        self.value = 0

obj = MyClass().__init__()  # Redundant - __init__ already called
```

**Flowchart**:
```mermaid
assign1["obj = MyClass()"]
assign1 <-->|Call and Return| init2[["Constructor: __init__()"]]
warning3[["⚠️ Redundant __init__ call: MyClass() already calls constructor"]]
```

---

#### 6. Nesting Limit Exceeded

**When Created**: Function call depth exceeds MAX_NESTING_DEPTH

**Text**: `Call: function_name() (Max nesting depth 6 exceeded)`

**Example**: See "Nesting Depth Limits" section above.

---

### Error Node Shape

All error/warning nodes use the **exception shape**:
```python
shape = FlowchartConfig.SHAPES['exception']  # [["text"]]
```

---

## Exit Function Handling

### Purpose

Detect program exit calls and connect directly to end node.

### Recognized Functions

```python
EXIT_FUNCTIONS = ['sys.exit', 'os._exit', 'exit', 'quit']
```

### How It Works

**Detection**:
```python
# In ExprHandler:
if func_name in FlowchartConfig.EXIT_FUNCTIONS or \
   (hasattr(call.func, 'attr') and 
    f"{ast.unparse(call.func.value)}.{call.func.attr}" in FlowchartConfig.EXIT_FUNCTIONS):
    # Create exit node
    exit_id = self.processor._generate_id("exit")
    self.processor._add_node(exit_id, text, shape=FlowchartConfig.SHAPES['exit'])
    self.processor._add_connection(prev_id, exit_id)
    self.processor._add_connection(exit_id, self.processor.end_id)
    return None  # Stop processing
```

### Example

**Code**:
```python
if error:
    print("Fatal error")
    sys.exit(1)
print("This won't execute")
```

**Flowchart**:
```mermaid
if_cond1{"if error"}
if_cond1 -->|True| print2["print(`Fatal error`)"]
print2 --> exit3[/"sys.exit(1)"\]
exit3 --> end4[End]
# "This won't execute" not shown
```

**Key Points**:
1. Exit node created with trapezoid shape
2. Direct connection to end node
3. Handler returns `None` to stop processing remaining code
4. Code after exit is not processed

---

## Max Nodes Limit

### Purpose

Prevent excessive resource consumption on very large files.

### Configuration

**Default**: `MAX_NODES = 100`

**Environment Variable**:
```bash
export MAX_NODES=50
```

### How It Works

**Check Before Adding Node**:
```python
def _add_node(self, node_id, text, shape=('["', '"]'), scope=None):
    if len(self.nodes) >= FlowchartConfig.MAX_NODES:
        return False  # Stop creating nodes
    # ... create node
    return True
```

**Handler Response**:
```python
# In _process_node_list:
if new_id is False:
    self._handle_max_nodes_exceeded(current_id)
    break  # Stop processing
```

**Max Nodes Handler**:
```python
def _handle_max_nodes_exceeded(self, last_node_id):
    """Handle case when max nodes limit is exceeded."""
    # Connect last node to end
    if last_node_id and last_node_id != self.end_id:
        self._add_connection(last_node_id, self.end_id)
```

### Example

**With MAX_NODES=10**:
- First 10 nodes created normally
- 11th node creation returns `False`
- Processing stops
- Last node (10th) connects to end

**Use Case**: Large legacy files with thousands of lines - prevent timeouts.

---

## Line Mapping

### Purpose

Map nodes to their original source code line numbers.

### How It Works

**Creation** (in `entry_processor.py`):
```python
def create_line_mapping(cls, code: str) -> dict:
    line_mapping = {}
    parsed = ast.parse(code)
    
    for node in parsed.body:
        if isinstance(node, ast.FunctionDef):
            line_mapping[node.name] = node.lineno
        elif isinstance(node, ast.ClassDef):
            line_mapping[node.name] = node.lineno
            for class_node in node.body:
                if isinstance(class_node, ast.FunctionDef):
                    method_key = f"{node.name}.{class_node.name}"
                    line_mapping[method_key] = class_node.lineno
    
    return line_mapping
```

**Structure**:
```python
{
    "calculate": 5,                # Function at line 5
    "User": 10,                    # Class at line 10
    "User.__init__": 12,           # Method at line 12
    "User.get_name": 15            # Method at line 15
}
```

### Use Cases

1. **Breakpoint Mapping**: Match breakpoints to functions
2. **Error Reporting**: Show which line caused an error
3. **IDE Integration**: Jump from flowchart to source code
4. **Node Highlighting**: Highlight nodes by source line

---

## Context Data Tracking

### Purpose

Store metadata about classes and functions for enhanced visualization.

### Data Structure

```python
self.context_data = {
    'MyClass': {
        'docstring': 'A sample class',
        'methods': ['__init__', 'method1', 'method2'],
        'class_variables': ['class_var1'],
        'type': 'class'
    },
    'my_function': {
        'docstring': 'A sample function',
        'type': 'function'
    }
}
```

### Collection

**In ClassHandler**:
```python
def _extract_class_context(self, class_node):
    docstring = ast.get_docstring(class_node) or ""
    methods = []
    class_variables = []
    
    for item in class_node.body:
        if isinstance(item, ast.FunctionDef):
            methods.append(item.name)
        elif isinstance(item, ast.Assign):
            for target in item.targets:
                if isinstance(target, ast.Name):
                    class_variables.append(target.id)
    
    self.processor.context_data[class_node.name] = {
        "docstring": docstring,
        "methods": sorted(methods),
        "class_variables": sorted(class_variables),
        "type": "class"
    }
```

### Use Cases

- Future: Tooltips showing docstrings
- Future: Class diagrams with variables
- Future: Enhanced metadata export

---

## Best Practices

### 1. Enable Recursion Detection

Always enabled by default - no configuration needed. Handles:
- Direct recursion (`factorial`)
- Mutual recursion (`f()` calls `g()`, `g()` calls `f()`)

### 2. Set Appropriate Nesting Depth

**Small projects**: Default (6) is fine

**Large projects with deep call stacks**:
```bash
export MAX_NESTING_DEPTH=10
```

**Performance-critical**:
```bash
export MAX_NESTING_DEPTH=3
```

### 3. Use Breakpoints Strategically

```bash
# Good: Highlight key decision points
export BREAKPOINT_LINES='42,55,67'

# Bad: Highlight too many lines
export BREAKPOINT_LINES='1,2,3,4,5,6,7,8,9,10'  # Too cluttered
```

### 4. Handle Error Nodes

When you see error/warning nodes:
1. Check if variable types are tracked
2. Verify method names are correct
3. Ensure class definitions are included

### 5. Monitor Max Nodes

If flowcharts are truncated:
```bash
export MAX_NODES=200  # Increase limit
# Or use entry points to focus on smaller code sections
```

---

## See Also

- [Configuration](CONFIGURATION.md) - MAX_NODES, MAX_NESTING_DEPTH, breakpoint config
- [Connections](CONNECTIONS.md) - Recursion loop back connections
- [Node Types](NODE_TYPES.md) - Error/warning node types
- [Type Tracking](TYPE_TRACKING.md) - Resolving types to prevent errors

