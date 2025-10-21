# Entry Points

## Overview

Entry points control **what code is visualized** in the flowchart. Instead of showing the entire file, you can focus on a specific function, class, or method to create targeted, clearer diagrams.

## Entry Types

The processor supports four entry types:

| Entry Type | What's Shown | Use Case |
|-----------|--------------|----------|
| **file** | Entire file (default) | Understanding overall program flow |
| **function** | Specific function | Analyzing function logic |
| **class** | Entire class | Understanding class structure |
| **method** | Specific class method | Debugging method behavior |

---

## Configuration

Entry points are configured via **environment variables**:

```bash
export ENTRY_TYPE=file          # file | function | class
export ENTRY_NAME=function_name  # Function or method name
export ENTRY_CLASS=ClassName     # Class name (required for methods)
```

---

## Entry Type: file

### Behavior

Shows the **entire file** with all classes, functions, and main flow code.

### Configuration

```bash
export ENTRY_TYPE=file
# or simply don't set ENTRY_TYPE (file is default)
```

### What's Included

- All top-level code
- All function definitions (created as subgraphs when called)
- All class definitions (created as subgraphs when instantiated)
- Main flow execution

### Example

**Code**:
```python
def calculate(x):
    return x * 2

class Calculator:
    def add(self, a, b):
        return a + b

result = calculate(5)
calc = Calculator()
total = calc.add(3, 4)
```

**Flowchart**:
- Shows `result = calculate(5)` → creates `calculate()` subgraph
- Shows `calc = Calculator()` → creates `Calculator` class subgraph
- Shows `total = calc.add(3, 4)` → creates `add()` method subgraph
- All definitions and main flow included

---

## Entry Type: function

### Behavior

Focuses on a **specific function** and its execution.

### Configuration

```bash
export ENTRY_TYPE=function
export ENTRY_NAME=my_function
```

### What's Included

- The target function definition
- All other function and class definitions (for potential calls)
- A synthesized call to the target function: `my_function()`
- No main flow code from the original file

### Code Extraction Process

The `EntryProcessor.process_function()` method:

1. **Extracts all definitions**:
   ```python
   code = cls.append_definitions(code)  # Gets all function/class defs
   ```

2. **Adds function call**:
   ```python
   call_line = f"{entry_name}()\n"
   ```

3. **Returns modified code**:
   ```python
   return code, call_line  # Definitions + call
   ```

### Example

**Code** (`example.py`):
```python
def helper():
    return 42

def calculate(x):
    return x + helper()

result = calculate(5)  # Main flow - won't be shown
```

**Command**:
```bash
export ENTRY_TYPE=function
export ENTRY_NAME=calculate
python main.py example.py
```

**Effective Code Analyzed**:
```python
def helper():
    return 42

def calculate(x):
    return x + helper()

calculate()  # Synthesized call
```

**Flowchart**:
- Start → `calculate()` call
- `calculate` subgraph showing:
  - `return x + helper()`
  - Call to `helper()` subgraph
  - `helper` subgraph showing `return 42`

### Use Cases

- **Debugging a specific function** without clutter from main flow
- **Understanding function dependencies** (what it calls)
- **Documenting function behavior** for API documentation

---

## Entry Type: class

### Behavior

Focuses on a **specific class** and its structure.

### Configuration

```bash
export ENTRY_TYPE=class
export ENTRY_CLASS=MyClass
# No ENTRY_NAME - shows entire class
```

### What's Included

- The target class definition with all methods
- All other function and class definitions (for potential calls)
- A synthesized instantiation: `MyClass()`
- Calls constructor (`__init__`) if present
- No main flow code from the original file

### Code Extraction Process

The `EntryProcessor.process_class()` method:

1. **Extracts all definitions**:
   ```python
   code = cls.append_definitions(code)
   ```

2. **Adds class instantiation**:
   ```python
   call_line = f"{entry_class}()\n"
   ```

3. **Returns modified code**:
   ```python
   return code, call_line
   ```

### Example

**Code** (`example.py`):
```python
class Database:
    def connect(self):
        return "Connected"

class UserService:
    def __init__(self, db):
        self.db = db
    
    def get_user(self, user_id):
        self.db.connect()
        return f"User {user_id}"

# Main flow - won't be shown
db = Database()
service = UserService(db)
user = service.get_user(123)
```

**Command**:
```bash
export ENTRY_TYPE=class
export ENTRY_CLASS=UserService
python main.py example.py
```

**Effective Code Analyzed**:
```python
class Database:
    def connect(self):
        return "Connected"

class UserService:
    def __init__(self, db):
        self.db = db
    
    def get_user(self, user_id):
        self.db.connect()
        return f"User {user_id}"

UserService()  # Synthesized instantiation
```

**Flowchart**:
- Start → `UserService()` instantiation
- Connects to `__init__` constructor
- Shows `UserService` class subgraph with:
  - `__init__` method subgraph
  - `get_user` method subgraph (if called)
- Shows `Database` class (referenced but not instantiated in entry flow)

### Use Cases

- **Understanding class structure** and method relationships
- **Analyzing initialization logic** (`__init__`)
- **Documenting class API** for developers

---

## Entry Type: function (Class Method)

### Behavior

Focuses on a **specific method within a class**.

### Configuration

```bash
export ENTRY_TYPE=function
export ENTRY_CLASS=MyClass
export ENTRY_NAME=my_method
```

**Note**: Use `ENTRY_TYPE=function` (not `class`) when targeting a method.

### What's Included

- The target class definition with all methods
- All other function and class definitions (for potential calls)
- A synthesized static method call: `MyClass.my_method()`
- No main flow code from the original file

### Code Extraction Process

The `EntryProcessor.process_class_method()` method:

1. **Extracts all definitions**:
   ```python
   code = cls.append_definitions(code)
   ```

2. **Adds static method call**:
   ```python
   call_line = f"{entry_class}.{entry_name}()\n"
   ```

3. **Returns modified code**:
   ```python
   return code, call_line
   ```

### Example

**Code** (`example.py`):
```python
class Calculator:
    def __init__(self):
        self.value = 0
    
    def add(self, a, b):
        return a + b
    
    def multiply(self, a, b):
        return a * b

# Main flow - won't be shown
calc = Calculator()
result = calc.add(2, 3)
```

**Command**:
```bash
export ENTRY_TYPE=function
export ENTRY_CLASS=Calculator
export ENTRY_NAME=add
python main.py example.py
```

**Effective Code Analyzed**:
```python
class Calculator:
    def __init__(self):
        self.value = 0
    
    def add(self, a, b):
        return a + b
    
    def multiply(self, a, b):
        return a * b

Calculator.add()  # Synthesized static call
```

**Flowchart**:
- Start → `Calculator.add()` call
- Shows `Calculator` class subgraph
- Shows `add` method subgraph with:
  - `return a + b`

### Use Cases

- **Debugging a specific method** in isolation
- **Understanding method logic** without class context
- **Testing method behavior** independently

---

## Entry Type: class (with method)

### Behavior

Alternative syntax for focusing on a **specific method within a class**.

### Configuration

```bash
export ENTRY_TYPE=class
export ENTRY_CLASS=MyClass
export ENTRY_NAME=my_method
```

**Note**: Same as `ENTRY_TYPE=function` with `ENTRY_CLASS` + `ENTRY_NAME`.

### What's Included

Identical to "function (Class Method)" above. Both syntaxes produce the same result.

---

## Entry Point Protection

### Automatic Protection

When an entry point is specified, its subgraph is **protected from collapsing**:

```python
# In post_processor.py _is_subgraph_too_large():
if hasattr(self, 'entry_name') and self.entry_name and scope == self.entry_name:
    return False  # Never collapse entry point
```

### Why Protection Matters

Without protection, large entry point subgraphs would collapse, defeating the purpose of focusing on them.

**Example**:
```bash
export ENTRY_TYPE=function
export ENTRY_NAME=large_function
export MAX_SUBGRAPH_NODES=10
# large_function has 50 nodes - would normally collapse
# But entry point protection keeps it expanded
```

---

## Line Mapping

The `EntryProcessor` creates a **line mapping** for accurate source tracking:

### Purpose

Maps function/method names to their original line numbers in the source file.

### Creation

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

### Structure

```python
{
    "my_function": 5,                    # Function at line 5
    "MyClass": 10,                        # Class at line 10
    "MyClass.my_method": 15,             # Method at line 15
    "MyClass.__init__": 12               # Constructor at line 12
}
```

### Use Cases

- **Breakpoint mapping**: Associate breakpoints with specific functions
- **Error reporting**: Show which line a node corresponds to
- **IDE integration**: Jump to source from flowchart

---

## Definition Extraction

### All Definitions Included

When using entry points, **all function and class definitions** are included:

```python
def append_definitions(cls, code) -> str:
    definitions = []
    parsed = ast.parse(code)
    for node in parsed.body:
        if isinstance(node, ast.FunctionDef) or isinstance(node, ast.ClassDef):
            definitions.append(ast.get_source_segment(code, node))
    return "\n".join(definitions)
```

### Why All Definitions?

Even if you're focusing on one function, it might call others:

```python
def helper():
    return 42

def main_function():
    return helper()  # Needs helper() definition

# Entry: main_function
# Includes: helper() definition for when it's called
```

### What's Excluded

Only **main flow code** (code not in functions/classes) is excluded:

```python
def my_function():
    return 42

# These lines are excluded when entry != 'file':
result = my_function()
print(result)
x = 5
```

---

## Entry Point Detection in Processor

The main processor checks entry point context:

```python
# In processor.py process_code():
entry_type = os.getenv('ENTRY_TYPE', 'file')
entry_name = os.getenv('ENTRY_NAME')
entry_class = os.getenv('ENTRY_CLASS')

context = {
    'entry_type': entry_type,
    'entry_name': entry_name,
    'entry_class': entry_class
}

# Extract code based on entry point
code, line_mapping = EntryProcessor.extract_code(python_code, context)
```

---

## Entry Point Visualization

### Synthesized Call Nodes

Entry point calls are **not special nodes** - they appear as regular function/method call nodes:

```python
# Entry: ENTRY_TYPE=function, ENTRY_NAME=calculate
# Synthesized: calculate()

# Flowchart shows:
start1[Start] --> method_call2[["Call: calculate()"]]
method_call2 <-->|Call and Return| calculate_subgraph
```

### Subgraph Creation

Entry point subgraphs are created immediately:

1. **Main flow**: `calculate()` call
2. **Subgraph**: `calculate` function body processed
3. **Connection**: Bidirectional arrow between call and subgraph

---

## Best Practices

### 1. Use Entry Points for Complex Files

**Without entry point** (entire file):
- 500+ nodes
- Hard to follow specific logic
- Cluttered with unrelated code

**With entry point** (specific function):
- 20-50 nodes
- Clear focus on target logic
- Only relevant dependencies shown

### 2. Combine with Collapse Configuration

```bash
# Focus on specific function
export ENTRY_TYPE=function
export ENTRY_NAME=process_order

# Hide helper functions
export FORCE_COLLAPSE_LIST='validate_input,log_debug'

# Always show key dependencies
export SUBGRAPH_WHITELIST='PaymentProcessor,Database'
```

### 3. Use Class Entry for Architecture Review

```bash
# Show entire class structure
export ENTRY_TYPE=class
export ENTRY_CLASS=UserService
```

Good for:
- Understanding class design
- Reviewing method interactions
- Documenting APIs

### 4. Use Method Entry for Debugging

```bash
# Focus on problematic method
export ENTRY_TYPE=function
export ENTRY_CLASS=UserService
export ENTRY_NAME=create_user
```

Good for:
- Debugging specific issues
- Understanding method logic
- Isolating problematic code

---

## Common Patterns

### Pattern 1: Progressive Zoom

Start broad, then narrow down:

```bash
# Step 1: Understand file
export ENTRY_TYPE=file

# Step 2: Focus on interesting class
export ENTRY_TYPE=class
export ENTRY_CLASS=UserService

# Step 3: Debug specific method
export ENTRY_TYPE=function
export ENTRY_CLASS=UserService
export ENTRY_NAME=create_user
```

### Pattern 2: Class Comparison

Compare related classes:

```bash
# Generate flowchart for UserService
export ENTRY_TYPE=class
export ENTRY_CLASS=UserService
python main.py services.py > user_service.mmd

# Generate flowchart for PaymentService
export ENTRY_CLASS=PaymentService
python main.py services.py > payment_service.mmd
```

### Pattern 3: Method Documentation

Generate focused documentation:

```bash
# Document each public method
for method in get_user create_user update_user delete_user; do
    export ENTRY_TYPE=function
    export ENTRY_CLASS=UserService
    export ENTRY_NAME=$method
    python main.py services.py > docs/$method.mmd
done
```

---

## Limitations

### 1. Dynamic Entry Points

Entry points must be **known at generation time**:

```python
# This won't work:
function_name = get_function_from_config()
export ENTRY_NAME=$function_name  # Must be literal
```

### 2. Method Overloading

Python doesn't support method overloading, but if using workarounds:

```python
class MyClass:
    def method(self, *args):
        if len(args) == 1:
            # ...
        elif len(args) == 2:
            # ...
```

Entry point shows the **entire method**, not specific overload paths.

### 3. Synthesized Calls Don't Show Arguments

The synthesized call is always empty:

```python
# Entry: my_function
# Synthesized: my_function()  # No arguments
# Won't show: my_function(42, "test")
```

This is by design - the flowchart shows the function logic, not a specific invocation.

---

## See Also

- [Subgraphs](SUBGRAPHS.md) - How entry points create subgraphs
- [Configuration](CONFIGURATION.md) - All environment variables
- [Collapse Priority](COLLAPSE_PRIORITY.md) - Entry point protection details

