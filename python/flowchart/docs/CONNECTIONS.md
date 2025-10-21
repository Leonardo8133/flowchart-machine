# Connections and Flow

## Overview

Connections represent the **flow of execution** between nodes in the flowchart. They show how control moves from one statement to another, including branching, loops, and function/method calls.

## Connection Types

### Standard Connection (`-->`)

**Syntax**: `node1 --> node2`

**Represents**: Sequential flow from one node to the next

**When Created**:
- After every statement in normal flow
- From condition nodes to branches
- From loop nodes to loop body and exit

**Example**:
```python
x = 5
y = 10
print(x + y)
```

**Connections**:
```mermaid
assign1["x = 5"] --> assign2["y = 10"]
assign2 --> print3["print(x + y)"]
```

---

### Bidirectional Connection (`<-->`)

**Syntax**: `node1 <--> node2`

**Represents**: Call and return semantics - flow goes into the target and comes back

**When Created**:
- Function calls
- Method calls
- Constructor (`__init__`) calls

**Why Bidirectional?**

Traditional function call visualization requires:
1. Call node → function entry
2. Function return → node after call

Bidirectional arrows simplify this:
- **→**: Flow into function/method
- **←**: Flow returns after execution

**Example**:
```python
def calculate():
    return 42

result = calculate()
```

**Connections**:
```mermaid
assign1["result = calculate()"] <--> method_calculate2[["Call: calculate()"]]
```

**Method Example**:
```python
class Calculator:
    def add(self, a, b):
        return a + b

calc = Calculator()
result = calc.add(2, 3)
```

**Connections**:
```mermaid
assign1["calc = Calculator()"] <-->|Call and Return| method___init__2
assign3["result = calc.add(2, 3)"] <-->|Call and Return| method_add4
```

---

### Labeled Connection

**Syntax**: `node1 -->|label| node2` or `node1 <-->|label| node2`

**Represents**: Annotated flow showing the reason for the connection

**Common Labels**:

| Label | Use Case | Example |
|-------|----------|---------|
| **True** | If condition true path | `if_cond1 -->\|True\| print2` |
| **False** | If condition false path | `if_cond1 -->\|False\| merge3` |
| **Next Iteration** | Loop continues | `for_loop1 -->\|Next Iteration\| loop_body2` |
| **Done** | Loop exits | `for_loop1 -->\|Done\| loop_exit3` |
| **Call and Return** | Method call | `assign1 <-->\|Call and Return\| method2` |
| **uses** | Class instantiation | `assign1 -->\|uses\| class2` |
| **Instantiate** | Class without `__init__` | `assign1 -->\|Instantiate\| class2` |

---

## Control Flow Connections

### If Statement

**Pattern**:
```
condition --> true_branch  (labeled "True")
condition --> false_branch (labeled "False")
true_branch --> merge
false_branch --> merge
merge --> next
```

**Example**:
```python
if x > 0:
    print("Positive")
else:
    print("Negative")
print("Done")
```

**Connections**:
```mermaid
if_cond1{"if x > 0"} -->|True| print2["print(`Positive`)"]
if_cond1 -->|False| print3["print(`Negative`)"]
print2 --> merge4
print3 --> merge4
merge4 --> print5["print(`Done`)"]
```

**If Without Else**:
```python
if x > 0:
    print("Positive")
print("Done")
```

**Connections**:
```mermaid
if_cond1{"if x > 0"} -->|True| print2["print(`Positive`)"]
print2 --> merge3
if_cond1 -->|False| merge3
merge3 --> print4["print(`Done`)"]
```

---

### For Loop

**Pattern**:
```
for_loop --> loop_body  (labeled "Next Iteration")
loop_body --> for_loop  (labeled "Next Iteration")
for_loop --> loop_exit  (labeled "Done")
```

**Example**:
```python
for i in range(3):
    print(i)
print("Done")
```

**Connections**:
```mermaid
for_loop1{{"for i in range(3)"}} -->|Next Iteration| print2["print(i)"]
print2 --> for_loop1
for_loop1 -->|Done| loop_exit3
loop_exit3 --> print4["print(`Done`)"]
```

---

### While Loop

**Pattern**:
```
while_cond --> loop_body (labeled "Next Iteration" or unlabeled)
loop_body --> while_cond (labeled "Next Iteration")
while_cond --> loop_exit (labeled "Done")
```

**Example**:
```python
count = 0
while count < 3:
    count += 1
print("Done")
```

**Connections**:
```mermaid
assign1["count = 0"] --> while_loop2{"while count < 3"}
while_loop2 --> augassign3["count += 1"]
augassign3 --> while_loop2
while_loop2 -->|Done| loop_exit4
loop_exit4 --> print5["print(`Done`)"]
```

---

### Try/Except

**Pattern**:
```
try_node --> try_body
try_body --> merge (on success)
try_node --> except_node (on exception)
except_node --> except_body
except_body --> merge
merge --> finally_node (if present)
```

**Example**:
```python
try:
    risky()
except ValueError:
    print("Error")
finally:
    cleanup()
```

**Connections**:
```mermaid
try1{"try"} --> risky2[["Call: risky()"]]
risky2 --> merge3
try1 --> except4[["Except: ValueError"]]
except4 --> print5["print(`Error`)"]
print5 --> merge3
merge3 --> finally6[/"finally"\]
```

---

### Break Statement

**Pattern**:
```
break_node --> loop_exit
(remaining loop body is disconnected)
```

**Example**:
```python
for i in range(10):
    if i == 5:
        break
    print(i)
```

**Connections**:
```mermaid
for_loop1 --> if_cond2{"if i == 5"}
if_cond2 -->|True| break3["break"]
break3 --> loop_exit4
if_cond2 -->|False| print5["print(i)"]
print5 --> for_loop1
```

**Note**: `break` returns `None` from the handler, stopping processing of remaining loop body.

---

### Continue Statement

**Pattern**:
```
continue_node --> loop_start
(remaining loop body is disconnected)
```

**Example**:
```python
for i in range(10):
    if i % 2 == 0:
        continue
    print(i)
```

**Connections**:
```mermaid
for_loop1 --> if_cond2{"if i % 2 == 0"}
if_cond2 -->|True| continue3["continue"]
continue3 --> for_loop1
if_cond2 -->|False| print4["print(i)"]
print4 --> for_loop1
```

---

## Function & Method Connections

### Function Call

**Standard Function**:
```python
def helper():
    return 42

result = helper()
```

**Connections**:
```mermaid
assign1["result = helper()"] <--> method_helper2[["Call: helper()"]]

subgraph "Function: helper"
    method_helper2[["Call: helper()"]]
    return3["return 42"]
    method_helper2 --> return3
end
```

**Key Points**:
1. Bidirectional arrow from call to function entry
2. No explicit return connection (bidirectional handles it)
3. Function body processed as subgraph

---

### Method Call

**Instance Method**:
```python
class Calculator:
    def add(self, a, b):
        return a + b

calc = Calculator()
result = calc.add(2, 3)
```

**Connections**:
```mermaid
assign1["calc = Calculator()"] <-->|Call and Return| method___init__2
assign3["result = calc.add(2, 3)"] <-->|Call and Return| method_add4

subgraph "Class: Calculator"
    subgraph "Method: add"
        method_add4[["Method: add(a, b)"]]
        return5["return a + b"]
        method_add4 --> return5
    end
end
```

**Label**: "Call and Return" indicates both call and return semantics

---

### Constructor Call (`__init__`)

**Class Instantiation**:
```python
class User:
    def __init__(self, name):
        self.name = name

user = User("John")
```

**Connections**:
```mermaid
assign1["user = User(`John`)"] <-->|Call and Return| method___init__2

subgraph "Class: User"
    subgraph "Method: __init__"
        method___init__2[["Constructor: __init__(name)"]]
        assign3["self.name = name"]
        method___init__2 --> assign3
    end
end
```

**Important**: After `__init__` completes, flow returns to the instantiation node, **not** to the last node of `__init__` body.

---

### Method Reuse

**Multiple Calls to Same Method**:
```python
class Calculator:
    def add(self, a, b):
        return a + b

calc = Calculator()
result1 = calc.add(2, 3)
result2 = calc.add(5, 7)
```

**Connections**:
```mermaid
assign1["calc = Calculator()"] <-->|Call and Return| method___init__2
assign3["result1 = calc.add(2, 3)"] <-->|Call and Return| method_add4
assign5["result2 = calc.add(5, 7)"] <-->|Call and Return| method_add4

subgraph "Class: Calculator"
    subgraph "Method: add"
        method_add4[["Method: add(a, b)"]]
        return6["return a + b"]
        method_add4 --> return6
    end
end
```

**Key Points**:
1. Same method subgraph reused for both calls
2. Multiple bidirectional arrows converge on the same method entry
3. No duplicate method subgraphs created

---

### Recursive Function Call

**Recursion**:
```python
def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n-1)
```

**Connections**:
```mermaid
subgraph "Function: factorial"
    method_factorial1[["Method: factorial(n)"]]
    if_cond2{"if n <= 1"}
    return3["return 1"]
    return4["return n * factorial(n-1)"]
    
    method_factorial1 --> if_cond2
    if_cond2 -->|True| return3
    if_cond2 -->|False| return4
    return4 --> method_factorial1  # Loop back
end
```

**Detection**:
```python
# In ExprHandler:
if self.processor._is_recursive_call(func_name, scope):
    # Create loop back to function start
    self.processor._add_connection(prev_id, func_start_node)
```

---

## Return Statement Behavior

### In Functions

**Function Return Connects to End**:
```python
def helper():
    return 42

result = helper()
print("Done")
```

**Connections**:
```mermaid
assign1["result = helper()"] <--> method_helper2
method_helper2 --> return3["return 42"]
return3 --> end4  # Connects to end (or call stack)
```

---

### In Methods

**Method Return Does NOT Connect**:
```python
class Calculator:
    def add(self, a, b):
        return a + b
```

**Connections**:
```mermaid
subgraph "Method: add"
    method_add1[["Method: add(a, b)"]]
    return2["return a + b"]
    method_add1 --> return2
    # No connection from return2 - bidirectional arrow handles return
end
```

**Why?**

The bidirectional arrow (`<-->`) already represents the return flow. Connecting return to end would create redundant connections.

**Code**:
```python
# In ReturnHandler:
if scope and scope.startswith("class_") and "_" in scope[6:]:
    # We're in a method - no need to connect back
    pass
```

---

## Connection Label Processing

### Label Setting

Labels are set when creating connections:

```python
# Explicit label
self.processor._add_connection(from_id, to_id, label="True")

# Bidirectional with label
self.processor._add_connection(from_id, to_id, label="Call and Return", bidirectional=True)
```

### Next Node Label

The processor supports **deferred labels** via `next_node_label`:

```python
# Set label for next connection
self.processor.next_node_label = "True"

# Process nodes - first connection uses the label
body_end = self.processor._process_node_list(node.body, cond_id, scope)
# Connection created: cond_id -->|True| first_body_node
```

**Usage in IfHandler**:
```python
# Process true path with "True" label
true_path_end = self.processor._process_node_list(
    node.body, cond_id, scope, next_node_label="True"
)

# Process false path with "False" label
false_path_end = self.processor._process_node_list(
    node.orelse, cond_id, scope, next_node_label="False"
)
```

---

## Special Connections

### Class Instantiation

**Without `__init__`**:
```python
class EmptyClass:
    pass

obj = EmptyClass()
```

**Connection**:
```mermaid
assign1["obj = EmptyClass()"] -->|Instantiate| class2
```

**With `__init__`**:
```mermaid
assign1["obj = MyClass()"] <-->|Call and Return| method___init__2
```

---

### Exit Functions

**Immediate End Connection**:
```python
if error:
    sys.exit(1)
print("This won't be shown")
```

**Connections**:
```mermaid
if_cond1 -->|True| exit2[/"sys.exit(1)"\]
exit2 --> end3
# No connection from if_cond1 False path - flow stops
```

---

### Property Access

**No Connection Created**:

Property access doesn't create nodes or connections:

```python
user.name  # Validates property exists, no node/connection
```

Only method calls create connections.

---

## Connection Optimization

### Merge Node Removal

The post-processor removes unnecessary merge nodes:

**Before**:
```mermaid
if_cond1 --> merge2
merge2 --> next3
```

**After**:
```mermaid
if_cond1 --> next3  # merge2 removed
```

**Process**:
1. Identify merge nodes: `{{}}`
2. Build forwarding map: `merge2 → next3`
3. Redirect all connections to merge nodes
4. Remove merge nodes from graph

---

### Subgraph Connection Redirection

When subgraphs collapse, connections redirect to collapsed node:

**Before Collapse**:
```mermaid
call1 <--> method_entry2
method_entry2 --> method_body3
method_body3 --> return4
```

**After Collapse**:
```mermaid
call1 <--> collapsed_nodes__class_MyClass_method_5
```

**Code** (in `post_processor.py`):
```python
def _redirect_connections_to_subgraphs(self):
    # Parse connections with bidirectional support
    conn_pattern = re.compile(r'\s*(\w+)\s*(<)?-->(?:\|(.*?)\|)?\s*(\w+)\s*')
    
    for conn_str in self.processor.connections:
        match = conn_pattern.match(conn_str)
        from_id, bidirectional, label, to_id = match.groups()
        
        # Redirect if target is in collapsed subgraph
        if to_id in collapsed_nodes:
            to_id = collapsed_node_id
        
        # Rebuild connection with correct arrow type
        arrow = '<-->' if bidirectional else '-->'
        new_connection = f'{from_id} {arrow}|{label}| {to_id}'
```

---

## Connection Validation

### None Handling

Connections ignore `None` values:

```python
def _add_connection(self, from_id, to_id, label="", bidirectional=False):
    if from_id is None or to_id is None:
        return  # Skip invalid connections
```

**Why?**

Some handlers return `None` to stop flow (e.g., `break`, `continue`).

---

### Max Nodes Exceeded

When max nodes exceeded, connections fall back:

```python
# In _add_connection:
if hasattr(from_id, 'lineno') and self.nodes:
    from_id = list(self.nodes.keys())[-1]  # Use last node
```

---

## Connection Debugging

### View All Connections

```python
print(processor.connections)
# ['    start1 --> assign2', '    assign2 --> print3', ...]
```

### Connection Format

All connections follow the pattern:
```
    <from_id> [<]-->[|label|] <to_id>
```

- Indented with 4 spaces (Mermaid syntax)
- Optional `<` before `-->` for bidirectional
- Optional `|label|` for labeled connections

---

## Best Practices

### 1. Use Bidirectional for Calls

Always use bidirectional arrows for function/method calls:

```python
# Good
call_node <-->|Call and Return| method_node

# Bad (don't do this)
call_node --> method_node
method_return --> call_node
```

### 2. Label Control Flow Branches

Always label condition branches:

```python
# Good
if_cond -->|True| true_branch
if_cond -->|False| false_branch

# Bad
if_cond --> true_branch  # Unclear which branch
```

### 3. Connect Merge Nodes

Always connect all paths to merge nodes:

```python
# Good
true_branch --> merge
false_branch --> merge
merge --> next

# Bad
true_branch --> next
false_branch --> next  # Parallel connections, unclear flow
```

---

## See Also

- [Node Types](NODE_TYPES.md) - What creates connections
- [Subgraphs](SUBGRAPHS.md) - Subgraph connection behavior
- [Advanced Features](ADVANCED_FEATURES.md) - Recursion and special flows

