# Subgraph System

## Overview

Subgraphs organize related nodes into visual containers within the flowchart. They represent classes, methods, and functions, providing hierarchical structure to complex code.

## What Subgraphs Represent

### Classes
A class subgraph contains:
- The class scope identifier
- All method subgraphs nested inside
- No direct nodes (class body is not shown)

**Example**:
```python
class Calculator:
    def add(self, a, b):
        return a + b
    
    def subtract(self, a, b):
        return a - b
```

**Subgraph Structure**:
```mermaid
subgraph "Class: Calculator"
    subgraph "Method: add"
        method_add1[["Method: add(a, b)"]]
        return2["return a + b"]
    end
    subgraph "Method: subtract"
        method_subtract3[["Method: subtract(a, b)"]]
        return4["return a - b"]
    end
end
```

---

### Methods
A method subgraph contains:
- Method entry node showing signature
- All nodes from the method body
- Return statement (if present)

Methods are always nested within their parent class subgraph.

---

### Functions
A function subgraph contains:
- Function entry node
- All nodes from the function body
- Return statement (if present)

Functions appear at the top level (not nested).

---

## Scope Naming Convention

Scopes follow a hierarchical naming pattern:

| Scope Type | Pattern | Example |
|-----------|---------|---------|
| **Main Flow** | (none) | `None` |
| **Function** | `functionName` | `calculate_total` |
| **Class** | `class_ClassName` | `class_Calculator` |
| **Method** | `class_ClassName_methodName` | `class_Calculator_add` |
| **Nested Method** | `class_ClassName_methodName` | `class_Calculator___init__` |

**Important**: Double underscores in method names like `__init__` become triple underscores in scope names: `class_Calculator___init__`

---

## When Subgraphs Are Created

### Automatic Creation

Subgraphs are created automatically during post-processing when:

1. **Class is instantiated or method is called**
   ```python
   calc = Calculator()  # Creates Calculator class subgraph
   ```

2. **Function is called**
   ```python
   result = calculate_total(items)  # Creates calculate_total subgraph
   ```

3. **Entry point is a class or function**
   ```bash
   export ENTRY_TYPE=class
   export ENTRY_CLASS=Calculator
   # Creates Calculator subgraph at start
   ```

### Creation Process

The post-processor (`post_processor.py`) creates subgraphs in `_build_subgraphs()`:

1. **Collect scopes**: Identify all unique scopes from `node_scopes`
2. **Sort hierarchically**: Classes first, then methods, then functions
3. **Build nested structure**: Methods nest inside classes
4. **Generate Mermaid syntax**: Convert to `subgraph "Name"` blocks

---

## Subgraph Nesting

### Class-Method Nesting

Methods are always nested inside their parent class:

```mermaid
subgraph "Class: UserService"
    subgraph "Method: __init__"
        ...
    end
    subgraph "Method: create_user"
        ...
    end
    subgraph "Method: get_user"
        ...
    end
end
```

### Hierarchy Extraction

The processor automatically infers class-method relationships:

```python
# Scope: "class_UserService_create_user"
# Extracted:
#   - Class: "UserService"
#   - Method: "create_user"
# Result: Nests create_user inside UserService subgraph
```

---

## Collapsed vs Expanded Subgraphs

### Size-Based Collapsing

Subgraphs automatically collapse when they exceed the node threshold:

**Default Threshold**: `MAX_SUBGRAPH_NODES = 25`

**Collapsed Representation**:
```mermaid
subgraph "Method: large_method (42 nodes)"
    collapsed_nodes__class_MyClass_large_method_42["Collapsed nodes (42)"]
end
```

### Collapse Priority Rules

See [Collapse Priority](COLLAPSE_PRIORITY.md) for detailed priority rules.

**Summary**:
1. Force collapse EXACT match (highest priority)
2. Whitelist EXACT match
3. Entry point protection
4. Force collapse PATTERN match
5. Whitelist PATTERN match
6. Size-based (lowest priority)

### Configuration

```bash
# Set custom threshold
export MAX_SUBGRAPH_NODES=15

# Whitelist specific subgraphs (never collapse)
export SUBGRAPH_WHITELIST='Calculator,Database'

# Force collapse specific subgraphs (always collapse)
export FORCE_COLLAPSE_LIST='class_UserService___init__,class_Database_query'
```

---

## Connection Behavior

### Connecting to Subgraphs

Connections from main flow to subgraphs connect to the **subgraph entry node**:

```python
calc = Calculator()  # Main flow
result = calc.add(2, 3)  # Calls method in subgraph
```

**Connection**:
```mermaid
assign1["calc = Calculator()"] <-->|Call and Return| method_add2[["Method: add(a, b)"]]
```

The bidirectional arrow shows:
- **→**: Flow into the method
- **←**: Flow returns after method completes

### Connecting from Subgraphs

Connections from within subgraphs:

1. **Method to Method**: Same class methods can call each other
   ```python
   class Calculator:
       def add(self, a, b):
           return a + b
       
       def add_three(self, a, b, c):
           return self.add(a, b) + c  # Calls add() method
   ```

2. **Method to External Function**: Methods can call external functions
   ```python
   def helper():
       return 42
   
   class MyClass:
       def method(self):
           return helper()  # Calls external function
   ```

### Collapsed Subgraph Connections

When a subgraph is collapsed, connections redirect to the collapsed node:

**Before Collapse**:
```mermaid
method_call1 <--> method_body2
method_body2 --> return3
```

**After Collapse**:
```mermaid
method_call1 <--> collapsed_nodes__class_MyClass_method_5
```

The post-processor's `_redirect_connections_to_subgraphs()` handles this automatically.

---

## Method Reuse

### Same Method, Same Subgraph

When the same method is called multiple times, **the same subgraph is reused**:

```python
class Calculator:
    def add(self, a, b):
        return a + b

calc = Calculator()
result1 = calc.add(2, 3)    # Creates add() subgraph
result2 = calc.add(5, 7)    # Reuses same subgraph
result3 = calc.add(10, 15)  # Reuses same subgraph
```

**Flowchart**:
```mermaid
assign1["calc = Calculator()"]
assign2["result1 = calc.add(2, 3)"]
assign3["result2 = calc.add(5, 7)"]
assign4["result3 = calc.add(10, 15)"]

subgraph "Class: Calculator"
    subgraph "Method: add"
        method_add5[["Method: add(a, b)"]]
        return6["return a + b"]
    end
end

assign2 <-->|Call and Return| method_add5
assign3 <-->|Call and Return| method_add5
assign4 <-->|Call and Return| method_add5
```

### Method Reuse Tracking

The processor tracks created method subgraphs in `processor.method_subgraphs`:

```python
# First call to add()
if (class_name, method_name) not in self.processor.method_subgraphs:
    # Create new subgraph
    self.processor.method_subgraphs[(class_name, method_name)] = method_entry_id
else:
    # Reuse existing subgraph
    method_entry_id = self.processor.method_subgraphs[(class_name, method_name)]
```

**Benefits**:
1. Reduces visual clutter
2. Shows that method logic is shared
3. Makes flowchart more compact

---

## Subgraph Metadata

When subgraphs are collapsed, metadata is stored in `FlowchartPostProcessor.collapsed_subgraphs`:

```python
{
    "class_UserService_create_user": {
        "node_count": 28,
        "original_scope": "class_UserService_create_user",
        "subgraph_name": "Method: create_user (28 nodes)",
        "collapsed_node_id": "collapsed_nodes__class_UserService_create_user_28",
        "scope_nodes": ["node1", "node2", "node3", ...]  # All node IDs in subgraph
    }
}
```

This metadata is returned in the generator output and can be used by the frontend to expand collapsed subgraphs interactively.

---

## Entry Point Subgraphs

When an entry point is specified, the corresponding subgraph is:

1. **Always created** (even if it would normally be collapsed)
2. **Protected from collapsing** (entry point protection rule)
3. **Shows only relevant code** (entry processor extracts just that function/class/method)

**Example**:
```bash
export ENTRY_TYPE=class
export ENTRY_CLASS=Calculator
export ENTRY_NAME=add
```

**Result**:
- Only `Calculator` class and `add()` method are shown
- `add()` subgraph is always expanded
- Main flow shows call to `Calculator.add()`

---

## Special Cases

### Empty Subgraphs

Classes without visible nodes still create subgraphs if they have methods:

```python
class EmptyClass:
    def method(self):
        pass
```

Creates a class subgraph containing just the `method` subgraph.

### Nested Classes

Nested classes are treated as independent scopes:

```python
class Outer:
    class Inner:
        def method(self):
            pass
```

**Scopes**:
- `class_Outer`
- `class_Inner` (not nested in Outer)

### Static Methods

Static methods are treated the same as instance methods:

```python
class Calculator:
    @staticmethod
    def add(a, b):
        return a + b

Calculator.add(2, 3)  # Creates add() subgraph
```

---

## Subgraph Optimization

The post-processor applies optimizations:

### 1. Merge Node Removal

Merge nodes (`{{}}`) used for control flow are optimized away when possible:

```python
# Before optimization
if_cond1 --> merge2
merge2 --> next3

# After optimization
if_cond1 --> next3  # merge2 removed
```

### 2. Connection Redirection

When nodes are removed or collapsed, connections are redirected:

```python
# Node A connects to Node B in subgraph
# Subgraph collapses to collapsed_node_X
# Connection redirects: A --> collapsed_node_X
```

### 3. Scope Inference

If methods exist but class scope doesn't, it's inferred:

```python
# Scopes found: ["class_Calculator_add", "class_Calculator_subtract"]
# Inferred: "class_Calculator" (even if no class node exists)
```

---

## Best Practices

### 1. Keep Methods Focused

Methods under 25 nodes stay expanded by default:
```python
# Good: Focused method
def calculate_total(items):
    return sum(item.price for item in items)

# Consider splitting: Large method
def process_order(order):
    # 50+ lines of complex logic...
```

### 2. Use Whitelist for Key Classes

Whitelist important classes to always show their structure:
```bash
export SUBGRAPH_WHITELIST='UserService,PaymentProcessor'
```

### 3. Force Collapse Boilerplate

Hide repetitive initialization code:
```bash
export FORCE_COLLAPSE_LIST='__init__,setUp,tearDown'
```

### 4. Configure Threshold for Your Use Case

**Small projects**: Keep default (25 nodes)  
**Large codebases**: Reduce threshold
```bash
export MAX_SUBGRAPH_NODES=15
```

---

## Debugging Subgraphs

### View All Scopes

The processor tracks all scopes in `processor.node_scopes`:

```python
print(processor.node_scopes)
# {'assign1': None, 'method_add2': 'class_Calculator_add', ...}
```

### View Collapsed Subgraphs

Check metadata output:

```python
mermaid_output, metadata = generator.generate_from_code(code)
print(metadata['collapsed_subgraphs'])
```

### View Subgraph Hierarchy

The post-processor builds hierarchy in `_build_subgraphs()`:

```python
# Scopes: ['class_Calculator', 'class_Calculator_add', 'class_Calculator_subtract']
# Hierarchy:
#   class_Calculator
#   ├── class_Calculator_add
#   └── class_Calculator_subtract
```

---

## See Also

- [Collapse Priority](COLLAPSE_PRIORITY.md) - Detailed collapse rules
- [Node Types](NODE_TYPES.md) - What creates subgraphs
- [Connections](CONNECTIONS.md) - How subgraphs connect
- [Configuration](CONFIGURATION.md) - Subgraph configuration options

