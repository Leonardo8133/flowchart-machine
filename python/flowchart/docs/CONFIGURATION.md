# Configuration Reference

## Overview

The flowchart processor is highly configurable through **environment variables**. This allows you to control what's shown, how nodes are processed, and when subgraphs collapse.

## Configuration Categories

1. **Display Toggles** - Show/hide node types
2. **Entry Points** - Focus on specific code
3. **Subgraph Control** - Collapse behavior
4. **Limits** - Processing constraints
5. **Breakpoints** - Highlighting specific lines

---

## Display Toggle Variables

Control which node types appear in the flowchart.

### SHOW_PRINTS

**Controls**: Print statement visibility

**Values**: `0` (hide) | `1` (show, default)

**Example**:
```bash
export SHOW_PRINTS=0
```

**Affected Nodes**:
```python
print("Hello")  # Hidden when SHOW_PRINTS=0
print(f"Value: {x}")  # Hidden
```

**Use Case**: Hide verbose logging/debug prints for cleaner high-level flowcharts.

---

### SHOW_FUNCTIONS

**Controls**: Function call visibility

**Values**: `0` (hide) | `1` (show, default)

**Example**:
```bash
export SHOW_FUNCTIONS=0
```

**Affected Nodes**:
```python
result = calculate()  # Hidden when SHOW_FUNCTIONS=0
helper()  # Hidden
```

**Use Case**: Focus on control flow without function call details.

**Note**: Method calls are **not affected** (always shown for OOP analysis).

---

### SHOW_FOR_LOOPS

**Controls**: For loop visibility

**Values**: `0` (hide) | `1` (show, default)

**Example**:
```bash
export SHOW_FOR_LOOPS=0
```

**Affected Nodes**:
```python
for i in range(10):  # Hidden when SHOW_FOR_LOOPS=0
    process(i)  # Loop body still processed
```

**Use Case**: Simplify flowcharts by hiding iteration details.

---

### SHOW_WHILE_LOOPS

**Controls**: While loop visibility

**Values**: `0` (hide) | `1` (show, default)

**Example**:
```bash
export SHOW_WHILE_LOOPS=0
```

**Affected Nodes**:
```python
while condition:  # Hidden when SHOW_WHILE_LOOPS=0
    process()  # Loop body still processed
```

---

### SHOW_VARIABLES

**Controls**: Variable assignment visibility

**Values**: `0` (hide) | `1` (show, default)

**Example**:
```bash
export SHOW_VARIABLES=0
```

**Affected Nodes**:
```python
x = 5  # Hidden when SHOW_VARIABLES=0
name = "John"  # Hidden
result = calculate()  # Hidden (assignment part)
```

**Use Case**: Focus on control flow and function calls, not data manipulation.

**Note**: Class instantiations are **always shown** (needed for method tracking).

---

### SHOW_IFS

**Controls**: If statement visibility

**Values**: `0` (hide) | `1` (show, default)

**Example**:
```bash
export SHOW_IFS=0
```

**Affected Nodes**:
```python
if x > 0:  # Hidden when SHOW_IFS=0
    print("Positive")  # Still processed
else:
    print("Negative")  # Still processed
```

**Use Case**: Simplify flowcharts when branching logic is not relevant.

---

### SHOW_IMPORTS

**Controls**: Import statement visibility

**Values**: `0` (hide) | `1` (show, default)

**Example**:
```bash
export SHOW_IMPORTS=0
```

**Affected Nodes**:
```python
import os  # Hidden when SHOW_IMPORTS=0
from pathlib import Path  # Hidden
```

**Note**: Only the **first import** is shown by default (to reduce clutter).

---

### SHOW_EXCEPTIONS

**Controls**: Try/except block visibility

**Values**: `0` (hide) | `1` (show, default)

**Example**:
```bash
export SHOW_EXCEPTIONS=0
```

**Affected Nodes**:
```python
try:  # Hidden when SHOW_EXCEPTIONS=0
    risky()
except ValueError:  # Hidden
    handle_error()
```

---

### SHOW_RETURNS

**Controls**: Return statement visibility

**Values**: `0` (hide) | `1` (show, default)

**Example**:
```bash
export SHOW_RETURNS=0
```

**Affected Nodes**:
```python
return result  # Hidden when SHOW_RETURNS=0
return calculate()  # Hidden
```

**Note**: Hiding returns may make function/method flow unclear.

---

### SHOW_CLASSES

**Controls**: Class definition visibility

**Values**: `0` (hide) | `1` (show, default)

**Example**:
```bash
export SHOW_CLASSES=0
```

**Affected Nodes**:
```python
class MyClass:  # Hidden when SHOW_CLASSES=0
    def method(self):
        pass
```

**Note**: Class definitions don't create visual nodes, but hiding them prevents class tracking.

---

### MERGE_COMMON_NODES

**Controls**: Node consolidation behavior

**Values**: `0` (off) | `1` (on, default)

**Example**:
```bash
export MERGE_COMMON_NODES=0
```

**Behavior**:

**With MERGE_COMMON_NODES=1** (default):
```python
x = 5
y = 10
print(x)
```
**Single Node**: `x = 5\ny = 10\nprint(x)`

**With MERGE_COMMON_NODES=0**:
```python
x = 5
y = 10
print(x)
```
**Three Nodes**: `x = 5` → `y = 10` → `print(x)`

**What's Merged**:
- Simple assignments
- Print statements
- Augmented assignments

**Not Merged**:
- Control flow nodes (if, for, while)
- Function/method calls
- Nodes in different scopes

---

## Entry Point Variables

Control what code is visualized. See [Entry Points](ENTRY_POINTS.md) for detailed documentation.

### ENTRY_TYPE

**Values**: `file` (default) | `function` | `class`

**Purpose**: Specifies what code to analyze

**Examples**:
```bash
# Entire file (default)
export ENTRY_TYPE=file

# Specific function
export ENTRY_TYPE=function
export ENTRY_NAME=my_function

# Entire class
export ENTRY_TYPE=class
export ENTRY_CLASS=MyClass

# Specific method
export ENTRY_TYPE=function
export ENTRY_CLASS=MyClass
export ENTRY_NAME=my_method
```

---

### ENTRY_NAME

**Required When**: `ENTRY_TYPE=function` or `ENTRY_TYPE=class` with method

**Purpose**: Function or method name to analyze

**Example**:
```bash
export ENTRY_TYPE=function
export ENTRY_NAME=calculate_total
```

---

### ENTRY_CLASS

**Required When**: Analyzing class or class method

**Purpose**: Class name containing target method

**Example**:
```bash
export ENTRY_TYPE=function
export ENTRY_CLASS=UserService
export ENTRY_NAME=create_user
```

---

## Subgraph Control Variables

Control when subgraphs collapse. See [Collapse Priority](COLLAPSE_PRIORITY.md) for detailed rules.

### MAX_SUBGRAPH_NODES

**Purpose**: Threshold for automatic subgraph collapsing

**Default**: `25`

**Values**: Any positive integer

**Behavior**: Subgraphs with more nodes than this value are automatically collapsed.

**Example**:
```bash
# Collapse subgraphs with >15 nodes
export MAX_SUBGRAPH_NODES=15

# Never auto-collapse (very large threshold)
export MAX_SUBGRAPH_NODES=1000
```

**Priority**: Lowest (size-based rule is the fallback after all other rules).

---

### SUBGRAPH_WHITELIST

**Purpose**: Protect specific subgraphs from collapsing

**Format**: Comma-separated list of scope names or class names

**Example**:
```bash
# Never collapse these subgraphs
export SUBGRAPH_WHITELIST='UserService,Database,Calculator'

# Protect specific methods
export SUBGRAPH_WHITELIST='class_UserService_create_user,class_Database_query'
```

**Matching**:
- **Exact**: `class_UserService` matches scope `class_UserService`
- **Pattern**: `UserService` matches `class_UserService`, `class_UserService_create_user`, etc.

**Priority**: 
- **Exact match**: 2nd highest (after force collapse exact)
- **Pattern match**: 5th (after force collapse pattern)

---

### FORCE_COLLAPSE_LIST

**Purpose**: Force specific subgraphs to always collapse

**Format**: Comma-separated list of scope names or class names

**Example**:
```bash
# Always collapse these subgraphs
export FORCE_COLLAPSE_LIST='__init__,setUp,tearDown'

# Collapse specific methods
export FORCE_COLLAPSE_LIST='class_UserService___init__,class_Database_query'
```

**Matching**:
- **Exact**: `class_UserService___init__` matches scope `class_UserService___init__`
- **Pattern**: `UserService` matches `class_UserService`, `class_UserService_create_user`, etc.

**Priority**: 
- **Exact match**: Highest (always wins)
- **Pattern match**: 4th (after whitelist exact, entry protection)

**Override Example**:
```bash
# Whitelist entire class but force collapse __init__
export SUBGRAPH_WHITELIST='UserService'
export FORCE_COLLAPSE_LIST='class_UserService___init__'
# Result: UserService methods expanded, __init__ collapsed (force exact wins)
```

---

## Processing Limit Variables

### MAX_NODES

**Purpose**: Maximum nodes to create before stopping

**Default**: `100`

**Values**: Any positive integer

**Behavior**: When limit is reached, flowchart generation stops and remaining nodes are skipped.

**Example**:
```bash
export MAX_NODES=50  # Stop after 50 nodes
```

**Use Case**: Prevent excessively large flowcharts from consuming too many resources.

**Detection**:
```python
# In processor.py _add_node:
if len(self.nodes) >= FlowchartConfig.MAX_NODES:
    return False  # Stop creating nodes
```

---

### MAX_NESTING_DEPTH

**Purpose**: Maximum function call nesting levels

**Default**: `6`

**Values**: Any positive integer

**Behavior**: Function calls beyond this depth show placeholder nodes instead of expanding.

**Example**:
```bash
export MAX_NESTING_DEPTH=3
```

**Flowchart Effect**:
```python
def level1():
    level2()

def level2():
    level3()

def level3():
    level4()  # Beyond depth 3

# Shows: "Call: level4() (Max nesting depth 3 exceeded)"
```

**Use Case**: Prevent infinite recursion visualization or overly deep call stacks.

---

## Breakpoint Variables

### HAS_BREAKPOINTS

**Purpose**: Enable breakpoint highlighting

**Values**: `0` (off, default) | `1` (on)

**Required**: Must be `1` for `BREAKPOINT_LINES` to take effect

**Example**:
```bash
export HAS_BREAKPOINTS=1
export BREAKPOINT_LINES='10,25,42'
```

---

### BREAKPOINT_LINES

**Purpose**: Specify which lines to highlight

**Format**: Comma-separated list of line numbers

**Example**:
```bash
export HAS_BREAKPOINTS=1
export BREAKPOINT_LINES='10,25,42'
```

**Flowchart Effect**:
Nodes created from code on lines 10, 25, or 42 are prefixed with 🔴:

```mermaid
assign5["🔴 x = calculate()"]
```

**Use Case**: Debugging - highlight specific lines of interest.

**Line Tracking**:
- Entry processor creates line mappings
- Processor checks `node.lineno` against breakpoint list
- Nodes matching breakpoint lines get 🔴 prefix

---

## Configuration Precedence

When multiple config options conflict:

1. **Force Collapse EXACT** (highest)
2. **Whitelist EXACT**
3. **Entry Point Protection**
4. **Force Collapse PATTERN**
5. **Whitelist PATTERN**
6. **MAX_SUBGRAPH_NODES** (lowest)

---

## Common Configuration Patterns

### Pattern 1: Clean High-Level View

```bash
export SHOW_PRINTS=0
export SHOW_VARIABLES=0
export SHOW_RETURNS=0
export MERGE_COMMON_NODES=1
export MAX_SUBGRAPH_NODES=10
```

**Result**: Only control flow and function/method calls, collapsed when large.

---

### Pattern 2: Detailed Debugging

```bash
export SHOW_PRINTS=1
export SHOW_VARIABLES=1
export SHOW_RETURNS=1
export MERGE_COMMON_NODES=0
export HAS_BREAKPOINTS=1
export BREAKPOINT_LINES='42,55,67'
```

**Result**: Every node visible, breakpoints highlighted, no merging.

---

### Pattern 3: Class Architecture View

```bash
export ENTRY_TYPE=class
export ENTRY_CLASS=UserService
export SUBGRAPH_WHITELIST='UserService'
export FORCE_COLLAPSE_LIST='__init__,_private_helper'
export SHOW_VARIABLES=0
```

**Result**: Focus on UserService, public methods expanded, helpers collapsed.

---

### Pattern 4: Function-Only Analysis

```bash
export SHOW_CLASSES=0
export SHOW_PRINTS=0
export SHOW_VARIABLES=0
export SHOW_IFS=0
export SHOW_FOR_LOOPS=0
```

**Result**: Only function calls and returns (extreme simplification).

---

## Environment Variable Loading

### In Code

```python
# In processor.py _load_display_config:
config_map = {
    'show_prints': 'SHOW_PRINTS',
    'show_functions': 'SHOW_FUNCTIONS',
    # ...
}

for attr, env_var in config_map.items():
    setattr(self, attr, os.environ.get(env_var, '1') == '1')
```

**Default**: All display flags default to `'1'` (on).

---

### In Shell

**Linux/Mac**:
```bash
export SHOW_PRINTS=0
python main.py input.py
```

**Windows PowerShell**:
```powershell
$env:SHOW_PRINTS='0'
python main.py input.py
```

**Windows CMD**:
```cmd
set SHOW_PRINTS=0
python main.py input.py
```

---

### Temporary (One-Off)

**Linux/Mac**:
```bash
SHOW_PRINTS=0 SHOW_VARIABLES=0 python main.py input.py
```

**Windows PowerShell**:
```powershell
$env:SHOW_PRINTS='0'; $env:SHOW_VARIABLES='0'; python main.py input.py
```

---

## Configuration Best Practices

### 1. Start Broad, Then Narrow

```bash
# Step 1: See everything
python main.py input.py

# Step 2: Hide noise
export SHOW_PRINTS=0
export SHOW_VARIABLES=0
python main.py input.py

# Step 3: Focus on specific function
export ENTRY_TYPE=function
export ENTRY_NAME=target_function
python main.py input.py
```

---

### 2. Use Whitelist for Important Code

```bash
# Always show core business logic
export SUBGRAPH_WHITELIST='UserService,PaymentProcessor,OrderManager'

# Hide boilerplate
export FORCE_COLLAPSE_LIST='__init__,setUp,tearDown'
```

---

### 3. Adjust Thresholds for Your Codebase

**Small projects** (< 1000 lines):
```bash
export MAX_SUBGRAPH_NODES=50  # Allow larger subgraphs
export MAX_NODES=200
```

**Large projects** (> 10,000 lines):
```bash
export MAX_SUBGRAPH_NODES=15  # Collapse more aggressively
export MAX_NODES=100
```

---

### 4. Use Breakpoints for Debugging

```bash
# Highlight problematic lines
export HAS_BREAKPOINTS=1
export BREAKPOINT_LINES='42,55,67'

# Focus on the function containing those lines
export ENTRY_TYPE=function
export ENTRY_NAME=problematic_function
```

---

## Troubleshooting

### Configuration Not Taking Effect

**Problem**: Changed env var but flowchart unchanged.

**Solutions**:
1. Check variable name spelling (case-sensitive)
2. Ensure value is exactly `'0'` or `'1'`
3. Restart shell or re-export
4. Verify with `echo $SHOW_PRINTS` (Linux/Mac) or `echo %SHOW_PRINTS%` (Windows)

---

### Too Many Nodes Hidden

**Problem**: Flowchart is empty or too sparse.

**Solutions**:
1. Check `SHOW_*` variables - ensure relevant ones are `'1'`
2. Check `ENTRY_TYPE` - might be filtering too much
3. Check `FORCE_COLLAPSE_LIST` - might be collapsing everything
4. Reset all to defaults: `unset SHOW_PRINTS SHOW_VARIABLES ...`

---

### Subgraphs Not Collapsing

**Problem**: Large subgraphs not collapsing as expected.

**Solutions**:
1. Lower `MAX_SUBGRAPH_NODES`
2. Check `SUBGRAPH_WHITELIST` - might be protecting them
3. Add to `FORCE_COLLAPSE_LIST`
4. Check collapse priority rules

---

### Breakpoints Not Showing

**Problem**: Red circles (🔴) not appearing.

**Solutions**:
1. Ensure `HAS_BREAKPOINTS=1`
2. Check `BREAKPOINT_LINES` format (comma-separated, no spaces)
3. Verify line numbers match actual code lines
4. Check if nodes on those lines are being created

---

## See Also

- [Entry Points](ENTRY_POINTS.md) - ENTRY_TYPE, ENTRY_NAME, ENTRY_CLASS details
- [Collapse Priority](COLLAPSE_PRIORITY.md) - Subgraph collapse rules
- [Node Types](NODE_TYPES.md) - What SHOW_* variables affect
- [Advanced Features](ADVANCED_FEATURES.md) - Breakpoints, recursion, nesting

