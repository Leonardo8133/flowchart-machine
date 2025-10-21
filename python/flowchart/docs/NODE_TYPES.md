# Node Types Reference

## Overview

The flowchart processor supports 26+ node types, each with a dedicated handler class. Nodes represent individual operations or statements in your Python code.

## Node Structure

Every node has:
- **ID**: Unique identifier (e.g., `if_cond5`, `assign3`, `method_call12`)
- **Text**: Human-readable description
- **Shape**: Visual representation in Mermaid
- **Scope**: Execution context (main flow, function, class, method)

---

## Control Flow Nodes

### If Statement
**Handler**: `IfHandler`  
**Shape**: Diamond `{"text"}`  
**AST Type**: `ast.If`

**Behavior**:
- Creates a condition node with the if expression
- Processes true branch with "True" label
- Processes false branch (else/elif) with "False" label
- Creates merge node to rejoin control flow
- If no else clause, connects condition directly to merge node with "False" label

**Example**:
```python
if x > 0:
    print("Positive")
else:
    print("Negative")
```
**Output**:
```mermaid
if_cond2{"if x > 0"}
if_cond2 -->|True| print3["print(`Positive`)"]
if_cond2 -->|False| print5["print(`Negative`)"]
```

---

### For Loop
**Handler**: `ForHandler`  
**Shape**: Double curly braces `{{"text"}}`  
**AST Type**: `ast.For`

**Behavior**:
- Creates loop condition node
- Processes loop body
- Connects body end back to loop start with "Next Iteration" label
- Creates exit merge node with "Done" label

**Example**:
```python
for i in range(5):
    print(i)
```
**Output**:
```mermaid
for_loop2{{"for i in range(5)"}}
for_loop2 -->|Next Iteration| print3["print(i)"]
print3 --> for_loop2
for_loop2 -->|Done| loop_exit4
```

---

### While Loop
**Handler**: `WhileHandler`  
**Shape**: Diamond `{"text"}`  
**AST Type**: `ast.While`

**Behavior**:
- Creates loop condition node (diamond shape)
- Processes loop body
- Connects body end back to condition with "Next Iteration" label
- Creates exit merge node with "Done" label when condition is false

**Example**:
```python
while count < 10:
    count += 1
```

---

### Break Statement
**Handler**: `BreakHandler`  
**Shape**: Rectangle `["text"]`  
**AST Type**: `ast.Break`

**Behavior**:
- Creates break node
- Connects to loop exit node from loop_stack
- Returns None to stop processing remaining loop body

**Example**:
```python
for i in range(10):
    if i == 5:
        break
```

---

### Continue Statement
**Handler**: `ContinueHandler`  
**Shape**: Rectangle `["text"]`  
**AST Type**: `ast.Continue`

**Behavior**:
- Creates continue node
- Connects back to loop start node from loop_stack
- Returns None to stop processing remaining loop body

---

### Try/Except
**Handler**: `TryHandler`  
**Shape**: Try `{"text"}`, Except `[["text"]]`, Finally `[/"text"\]`  
**AST Type**: `ast.Try`

**Behavior**:
- Creates try node with diamond shape
- Processes try body
- Creates except handler nodes for each exception type
- Processes except body
- Creates finally node if present
- Merges all paths back together

**Example**:
```python
try:
    risky_operation()
except ValueError:
    print("Error")
finally:
    cleanup()
```

---

### Raise Statement
**Handler**: `RaiseHandler`  
**Shape**: Exception `[["text"]]`  
**AST Type**: `ast.Raise`

**Behavior**:
- Creates raise node showing exception type
- Connects to end node (stops flow)

---

### With Statement
**Handler**: `WithHandler`  
**Shape**: Rectangle `["text"]`  
**AST Type**: `ast.With`

**Behavior**:
- Creates with node showing context manager
- Processes with body
- Implicitly handles context manager cleanup

**Example**:
```python
with open('file.txt') as f:
    data = f.read()
```

---

### Assert Statement
**Handler**: `AssertHandler`  
**Shape**: Rectangle `["text"]`  
**AST Type**: `ast.Assert`

**Behavior**:
- Creates assert node with condition
- Continues normal flow (assertion failures not visualized)

---

### Pass Statement
**Handler**: `PassHandler`  
**Shape**: None (skipped)  
**AST Type**: `ast.Pass`

**Behavior**:
- Skipped entirely (returns prev_id unchanged)
- Does not create a node

---

## Function & Method Nodes

### Function Definition
**Handler**: `FunctionDefHandler`  
**Shape**: None (stored, not rendered in main flow)  
**AST Type**: `ast.FunctionDef`

**Behavior**:
- Stores function AST node in `processor.function_defs`
- Does not create node in main flow
- Used when function is called to create subgraph

---

### Class Definition
**Handler**: `ClassHandler`  
**Shape**: None (stored, not rendered in main flow)  
**AST Type**: `ast.ClassDef`

**Behavior**:
- Stores class AST node in `processor.class_defs`
- Extracts all methods from class body
- Does not create node in main flow
- Creates dummy node to track scope for subgraph generation
- When instantiated, creates subgraph with all methods

**Class Storage Format**:
```python
class_defs[class_name] = {
    "node": class_ast_node,
    "methods": {
        "method_name": method_ast_node,
        "__init__": init_ast_node
    }
}
```

---

### Function Call
**Handler**: `ExprHandler` (for function calls)  
**Shape**: Double brackets `[["text"]]`  
**AST Type**: `ast.Call` (within `ast.Expr`)

**Behavior**:
- Creates function call node
- If function is defined in code, creates subgraph with function body
- Connects with bidirectional arrow (`<-->`)
- Tracks nesting depth (max 6 levels)
- Detects recursive calls and creates loop back

**Recursion Handling**:
```python
def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n-1)  # Creates loop back to function start
```

---

### Method Call
**Handler**: `MethodHandler`  
**Shape**: Double brackets `[["text"]]`  
**Used by**: `ExprHandler`, `AssignHandler`, `ReturnHandler`

**Behavior**:
- Creates method call node showing `Call: obj.method()`
- Resolves object type using variable/parameter/attribute tracking
- Looks up method in class definition
- Creates or reuses method subgraph
- Connects with bidirectional arrow and "Call and Return" label
- Shows error node if method not found or class can't be resolved

**Method Reuse**:
- Same method called multiple times reuses the same subgraph
- Tracked in `processor.method_subgraphs`

**Example**:
```python
class Calculator:
    def add(self, a, b):
        return a + b

calc = Calculator()
result = calc.add(2, 3)  # Creates subgraph for add()
result2 = calc.add(5, 7)  # Reuses same subgraph
```

---

### Constructor Call (`__init__`)
**Handler**: `ClassHandler._create_method_subgraph`  
**Shape**: Double brackets `[["Constructor: __init__(params)"]]`

**Behavior**:
- Created when class is instantiated
- Shows as "Constructor: __init__(params)"
- Connected with bidirectional arrow and "Call and Return" label
- Processes `__init__` body as method subgraph
- Returns to instantiation node after completion

**Example**:
```python
class User:
    def __init__(self, name):
        self.name = name

user = User("John")  # Creates Constructor node
```

---

### Return Statement
**Handler**: `ReturnHandler`  
**Shape**: Rectangle `["return value"]`  
**AST Type**: `ast.Return`

**Behavior**:
- Creates return node with return value
- In methods: Does not connect to end (bidirectional arrow handles return)
- In functions: Connects back to call stack or end
- Processes method calls in return value before creating return node

**Example**:
```python
def get_value():
    return 42  # Connects to function exit

class MyClass:
    def method(self):
        return self.value  # No end connection (bidirectional arrow)
```

---

## Data Nodes

### Assignment
**Handler**: `AssignHandler`  
**Shape**: Rectangle `["text"]`  
**AST Type**: `ast.Assign`

**Behavior**:
- Creates assignment node with variable and value
- Tracks variable types for class instantiations
- Handles function call assignments
- Handles class instantiation and connects to `__init__`
- Tracks attribute assignments (`self.attr = value`)
- Can be consolidated with previous assignments if `MERGE_COMMON_NODES=1`

**Special Cases**:
1. **Class Instantiation**: `obj = MyClass()` → tracks type, calls `__init__`
2. **Method Call Assignment**: `result = obj.method()` → creates method call, then assignment
3. **Attribute Assignment**: `self.db = db` → tracks attribute type for method resolution
4. **Redundant `__init__`**: `obj = MyClass().__init__()` → shows warning node

**Example**:
```python
x = 5  # Simple assignment
obj = MyClass()  # Class instantiation
result = obj.method()  # Method call assignment
```

---

### Augmented Assignment
**Handler**: `AugAssignHandler`  
**Shape**: Rectangle `["text"]`  
**AST Type**: `ast.AugAssign`

**Behavior**:
- Creates augmented assignment node (e.g., `count += 1`)
- Can be consolidated with previous simple assignments

**Operators**: `+=`, `-=`, `*=`, `/=`, `%=`, `**=`, `//=`, `&=`, `|=`, `^=`, `<<=`, `>>=`

---

### Print Statement
**Handler**: `PrintHandler`  
**Shape**: Print brackets `["text"]`  
**AST Type**: `ast.Call` where func.id == 'print'

**Behavior**:
- Creates print node with printed content
- Processes function calls within print arguments first
- Handles f-strings with embedded function calls
- Can be consolidated with other prints if `MERGE_COMMON_NODES=1`
- Configurable with `SHOW_PRINTS` environment variable

**Example**:
```python
print("Hello")  # Simple print
print(f"Value: {get_value()}")  # Processes get_value() first
```

---

### Expression
**Handler**: `ExprHandler`  
**Shape**: Rectangle `["text"]` or Double brackets `[["text"]]` for calls  
**AST Type**: `ast.Expr`

**Behavior**:
- Handles standalone expressions
- Routes function calls to function/method handlers
- Routes property access to PropertyHandler
- Skips expressions if they don't create visible nodes

---

## Special Nodes

### Import
**Handler**: `ImportHandler`, `ImportFromHandler`  
**Shape**: Trapezoid `[/"text"\]`  
**AST Type**: `ast.Import`, `ast.ImportFrom`

**Behavior**:
- Creates import node showing imported modules
- Only first import is shown to avoid clutter
- Configurable with `SHOW_IMPORTS` environment variable

**Example**:
```python
import os
from pathlib import Path  # Only first import shown
```

---

### Lambda
**Handler**: `LambdaHandler`  
**Shape**: Rectangle `["text"]`  
**AST Type**: `ast.Lambda`

**Behavior**:
- Creates lambda node with simplified representation
- Shows as `lambda_function`

---

### Comprehension
**Handler**: `ComprehensionHandler`  
**Shape**: Rectangle `["text"]`  
**AST Type**: `ast.ListComp`, `ast.DictComp`, `ast.SetComp`, `ast.GeneratorExp`

**Behavior**:
- Creates comprehension node with simplified representation
- Shows type of comprehension (list, dict, set, generator)

**Example**:
```python
squares = [x**2 for x in range(10)]  # Shows as list comprehension
```

---

### Exit Function
**Handler**: `ExitFunctionHandler`  
**Shape**: Exit trapezoid `[/"text"\]`  
**AST Type**: Detected by function name

**Behavior**:
- Creates exit node
- Connects directly to end node
- Recognized functions: `sys.exit()`, `os._exit()`, `exit()`, `quit()`

**Example**:
```python
if error:
    sys.exit(1)  # Creates exit node, connects to end
```

---

### Property Access
**Handler**: `PropertyHandler`  
**Shape**: None (validation only)

**Behavior**:
- Validates property access on objects
- Checks if property exists in class definition
- Shows error node if property not found
- Shows warning if accessing method as property
- Does not create node itself (just validation)

**Example**:
```python
class User:
    def __init__(self, name):
        self.name = name

user = User("John")
print(user.name)  # Valid property access
print(user.age)  # Error: property not found
```

---

## Error & Warning Nodes

### Method Not Found
**Shape**: Exception `[["text"]]`  
**Text**: `"❌ Method 'method_name' not found in ClassName"`

**When Created**:
- Method called on object but method doesn't exist in class
- Class resolved but method not in class definition

---

### Class Not Resolved
**Shape**: Exception `[["text"]]`  
**Text**: `"❌ Could not resolve class for method 'method_name'"`

**When Created**:
- Method called on object but object's class can't be determined
- Variable type not tracked
- Parameter type not found

---

### Property Not Found
**Shape**: Exception `[["text"]]`  
**Text**: `"❌ Property 'property_name' not found in ClassName"`

**When Created**:
- Attribute accessed on object but attribute doesn't exist
- PropertyHandler validation fails

---

### Redundant `__init__` Call
**Shape**: Exception `[["text"]]`  
**Text**: `"⚠️ Redundant __init__ call: ClassName() already calls constructor"`

**When Created**:
- Code explicitly calls `__init__` after instantiation
- Example: `obj = MyClass().__init__()`

---

### Nesting Limit Exceeded
**Shape**: Function call `[["text"]]`  
**Text**: `"Call: function_name() (Max nesting depth 6 exceeded)"`

**When Created**:
- Function call nesting exceeds `MAX_NESTING_DEPTH` (default: 6)
- Creates placeholder node instead of processing function body

---

## Node Consolidation

When `MERGE_COMMON_NODES=1`, consecutive simple nodes in the same scope can be merged:

**Eligible for Consolidation**:
- Print statements
- Simple assignments (no function calls)
- Augmented assignments

**Not Consolidated**:
- Control flow nodes (if, for, while)
- Function/method calls
- Nodes in different scopes

**Example**:
```python
x = 5
y = 10
print(x)
print(y)
```
**With consolidation**:
```
assign1["x = 5\ny = 10\nprint(x)\nprint(y)"]
```

---

## Configuration

### Visibility Flags

Control which node types are shown:

| Environment Variable | Node Type | Default |
|---------------------|-----------|---------|
| `SHOW_PRINTS` | Print statements | 1 (on) |
| `SHOW_FUNCTIONS` | Function calls | 1 (on) |
| `SHOW_FOR_LOOPS` | For loops | 1 (on) |
| `SHOW_WHILE_LOOPS` | While loops | 1 (on) |
| `SHOW_VARIABLES` | Variable assignments | 1 (on) |
| `SHOW_IFS` | If statements | 1 (on) |
| `SHOW_IMPORTS` | Import statements | 1 (on) |
| `SHOW_EXCEPTIONS` | Try/except blocks | 1 (on) |
| `SHOW_RETURNS` | Return statements | 1 (on) |
| `SHOW_CLASSES` | Class definitions | 1 (on) |
| `MERGE_COMMON_NODES` | Node consolidation | 1 (on) |

### Shape Reference

| Shape | Mermaid Syntax | Use Case |
|-------|----------------|----------|
| Rectangle | `["text"]` | Default shape for most nodes |
| Diamond | `{"text"}` | Conditions (if, while) |
| Double Curly | `{{"text"}}` | For loops |
| Double Bracket | `[["text"]]` | Function/method calls, exceptions |
| Trapezoid | `[/"text"\]` | Imports, exit functions, finally |
| Merge | `{{}}` | Control flow merge points |

---

## See Also

- [Connections & Flow](CONNECTIONS.md) - How nodes are connected
- [Subgraphs](SUBGRAPHS.md) - Grouping nodes by scope
- [Configuration](CONFIGURATION.md) - Complete configuration reference

