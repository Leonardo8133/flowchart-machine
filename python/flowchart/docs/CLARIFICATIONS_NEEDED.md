# Clarifications and Known Edge Cases

## Overview

This document captures behaviors that may be ambiguous, inconsistent, or require clarification. It serves as a reference for future development and as questions for the maintainer.

---

## Documented Behaviors

These behaviors are **currently implemented** but may benefit from clarification or discussion.

### 1. Class Definition Nodes

**Current Behavior**: Class definitions create a "dummy node" with empty text to track scope for subgraph generation, but this node is not visible in the flowchart.

**Code Location**: `handlers.py`, `ClassHandler.handle()`

**Question**: Is this the intended behavior, or should class definitions create a visible node?

**Impact**: 
- Classes appear only as subgraph titles, not as nodes
- Class instantiation connects to `__init__`, not to a class node

**Recommendation**: Current behavior seems appropriate for OOP visualization.

---

### 2. Method Reuse vs. Function Reuse

**Current Behavior**: 
- **Methods**: Same method called multiple times reuses the same subgraph
- **Functions**: Each function call might create a new subgraph (needs verification)

**Code Location**: `handlers.py`, `ClassHandler._create_method_subgraph()`

**Question**: Should functions also reuse subgraphs like methods do?

**Impact**:
- Methods are more compact (one subgraph, multiple connections)
- Functions may create duplicate subgraphs (unclear)

**Recommendation**: Verify function behavior and document the difference.

---

### 3. Return Statement Connection in Methods

**Current Behavior**: Return statements in methods do **not** connect to the end node. The bidirectional arrow handles the return semantics.

**Code Location**: `handlers.py`, `ReturnHandler.handle()`

```python
if scope and scope.startswith("class_") and "_" in scope[6:]:
    # We're in a method - no need to connect back
    pass
```

**Question**: Is this the clearest way to show method returns?

**Impact**:
- Cleaner flowcharts (no redundant connections)
- May be confusing if bidirectional arrow semantics aren't understood

**Recommendation**: Current behavior is correct. Document clearly in user guides.

---

### 4. __init__ Flow Return Point

**Current Behavior**: After `__init__` method completes, flow returns to the **instantiation node**, not the last node of the `__init__` body.

**Code Location**: `handlers.py`, `AssignHandler._handle_class_instantiation_assignment()`

```python
self.processor.handlers[ast.ClassDef]._create_method_subgraph(...)
# Returns assign_id (instantiation), not last node of __init__
return assign_id
```

**Question**: Is this the intended behavior?

**Impact**:
- Main flow continues from instantiation node
- Matches expected semantics (instantiation completes, then continues)

**Recommendation**: Current behavior is correct and matches user expectations.

---

### 5. Property Validation Without Node Creation

**Current Behavior**: `PropertyHandler` validates property access but doesn't create nodes. Property access is invisible in the flowchart unless it's part of another operation.

**Code Location**: `handlers.py`, `PropertyHandler.handle_property_access()`

**Question**: Should property access create visible nodes, or is validation-only appropriate?

**Impact**:
- Cleaner flowcharts (fewer nodes)
- Property access is implicit in nodes like `print(user.name)`

**Recommendation**: Current behavior appropriate. Property access is a detail, not a separate operation.

---

### 6. Error Nodes as Dead Ends

**Current Behavior**: Error nodes (method not found, class not resolved) are created but don't connect to anything further. Flow stops at the error.

**Code Location**: `handlers.py`, `MethodHandler.handle_method_call()`

**Question**: Should error nodes connect to end, or is stopping flow appropriate?

**Impact**:
- Clearly shows where problems occur
- Flow doesn't continue past errors (realistic)

**Recommendation**: Current behavior is appropriate. Errors indicate code that can't be processed.

---

### 7. Only First Import Shown

**Current Behavior**: Only the first import statement in a file is shown to reduce clutter.

**Code Location**: `handlers.py`, `ImportHandler.handle()`

```python
if not self.processor._first_import_rendered:
    # Show this import
    self.processor._first_import_rendered = True
else:
    return prev_id  # Skip subsequent imports
```

**Question**: Is showing only one import sufficient, or should all imports be shown (with SHOW_IMPORTS=1)?

**Impact**:
- Reduced clutter (good)
- May hide important imports (e.g., conditional imports)

**Recommendation**: Consider showing all imports when SHOW_IMPORTS=1, or add SHOW_ALL_IMPORTS flag.

---

### 8. Static Method Call Syntax

**Current Behavior**: Static method calls (e.g., `Calculator.add()`) are handled the same as instance method calls, using the class name as the "object type".

**Code Location**: `handlers.py`, `AssignHandler._resolve_object_type()`

```python
# Check if it's a direct class name
if var_name in self.processor.class_defs:
    return var_name  # Treat class as "instance"
```

**Question**: Should static methods be distinguished visually from instance methods?

**Impact**:
- Works correctly (method is called)
- No visual distinction between static and instance methods

**Recommendation**: Consider adding `@staticmethod` detection and different node text (e.g., "Static Method: add()").

---

### 9. Nested Attribute Access

**Current Behavior**: Only `self.attribute.method()` is resolved. General `obj.attr.method()` may not resolve correctly.

**Code Location**: `handlers.py`, `AssignHandler._resolve_object_type()`

**Question**: Should nested attribute access be fully supported?

**Impact**:
- Most common case (`self.db.connect()`) works
- Complex chains (`obj1.obj2.obj3.method()`) may fail

**Recommendation**: Document limitation. Full support would require significant type tracking enhancement.

---

### 10. Parameter Type Tracking Limited to __init__

**Current Behavior**: Only parameters passed to `__init__` are tracked for type resolution. Regular function/method parameters are not tracked.

**Code Location**: `handlers.py`, `AssignHandler._handle_class_instantiation_assignment()`

**Question**: Should all function/method parameters be tracked?

**Impact**:
- Common case (dependency injection in `__init__`) works
- Parameters in other methods not tracked

**Recommendation**: Document limitation. Full support would require data flow analysis.

---

## Potential Inconsistencies

### 1. Loop Connection Labels

**Observation**: For loops use "Next Iteration" label, while loops also use "Next Iteration" label. Both use "Done" for exit.

**Location**: `ForHandler` and `WhileHandler`

**Question**: Is the labeling consistent and clear?

**Current**:
- For: `for_loop -->|Next Iteration| body` and `body --> for_loop`
- While: `while_loop --> body` and `body -->|Next Iteration| while_loop`

**Inconsistency**: First connection in for loops is labeled, but not in while loops.

**Recommendation**: Make consistent - either label both or neither.

---

### 2. Merge Node Creation

**Observation**: Merge nodes are created for if/else, loops, and try/except, but their necessity varies.

**Location**: Various handlers

**Question**: When are merge nodes truly necessary vs. optimization targets?

**Current Behavior**:
- Always created for control flow rejoining
- Post-processor optimizes them away when possible

**Recommendation**: Current approach (create, then optimize) is safe. Document optimization rules.

---

### 3. Exit Function List

**Observation**: `EXIT_FUNCTIONS = ['sys.exit', 'os._exit', 'exit', 'quit']`

**Location**: `config.py`

**Question**: Is this list complete? Should it be configurable?

**Missing**:
- `raise SystemExit()`
- Custom exit functions

**Recommendation**: Make list configurable via environment variable.

---

## Edge Cases

### 1. Multiple Inheritance

**Case**: Class inherits from multiple base classes

```python
class Child(Parent1, Parent2):
    pass
```

**Current Behavior**: Inheritance not tracked or visualized

**Question**: Should parent class methods be available to instances?

**Recommendation**: Document that inheritance is not currently supported.

---

### 2. Decorators

**Case**: Functions/methods with decorators

```python
@decorator
def function():
    pass
```

**Current Behavior**: Decorator not shown in flowchart

**Question**: Should decorators be visualized?

**Recommendation**: Document that decorators are not currently visualized.

---

### 3. Generators and Async

**Case**: Generator functions, async functions, await expressions

```python
async def async_function():
    result = await some_call()
```

**Current Behavior**: Processed as regular functions

**Question**: Should async/await have special visualization?

**Recommendation**: Document that async is treated as regular flow.

---

### 4. Context Managers Without With

**Case**: Manual `__enter__` and `__exit__` calls

```python
cm = ContextManager()
cm.__enter__()
try:
    ...
finally:
    cm.__exit__(None, None, None)
```

**Current Behavior**: Shown as regular method calls

**Question**: Should this pattern be detected?

**Recommendation**: Document that only `with` statements have special handling.

---

### 5. Metaclasses

**Case**: Classes with custom metaclasses

```python
class MyClass(metaclass=Meta):
    pass
```

**Current Behavior**: Metaclass ignored

**Question**: Should metaclasses affect visualization?

**Recommendation**: Document that metaclasses are not supported.

---

## Feature Requests (Implicit from Code)

### 1. Type Hints

**Observation**: Type hints in function signatures could improve type resolution

```python
def process(data: UserData) -> Result:
    ...
```

**Current**: Type hints are ignored

**Potential**: Use type hints for better method resolution

---

### 2. Docstring Tooltips

**Observation**: `context_data` collects docstrings but they're not used

**Current**: Docstrings stored but not displayed

**Potential**: Add tooltips or metadata export with docstrings

---

### 3. Class Diagrams

**Observation**: Class structure is tracked but not visualized separately

**Current**: Only flowchart visualization

**Potential**: Generate UML-style class diagrams alongside flowcharts

---

### 4. Interactive Expansion

**Observation**: Collapsed subgraphs have metadata for expansion

**Current**: Static Mermaid output

**Potential**: Frontend that allows clicking to expand/collapse

**Note**: This might already be implemented in the webview code.

---

## Questions for Maintainer

1. **Import Visibility**: Should `SHOW_IMPORTS=1` show all imports or just the first?

2. **Static Methods**: Should `@staticmethod` and `@classmethod` have distinct visualization?

3. **Type Hints**: Should type annotations be used for type resolution?

4. **Inheritance**: Is inheritance support planned? Priority?

5. **Decorators**: Should decorators be visualized? How?

6. **Async/Await**: Special handling needed?

7. **Error Recovery**: When type resolution fails, should flow continue with assumptions or stop?

8. **Loop Label Consistency**: Should for and while loop labels be consistent?

9. **Exit Functions**: Should the exit function list be configurable?

10. **Consolidation Scope**: Should consolidation work across different statement types (e.g., print + assignment)?

---

## Recommendations for Future Development

### High Priority
1. Document inheritance limitations clearly
2. Make exit function list configurable
3. Standardize loop connection labels
4. Add type hint support for better resolution

### Medium Priority
5. Distinguish static/class methods visually
6. Support all imports when SHOW_IMPORTS=1
7. Add decorator visualization option
8. Enhance nested attribute resolution

### Low Priority
9. Add async/await specific visualization
10. Generate class diagrams alongside flowcharts
11. Support metaclass awareness

---

## Testing Coverage Gaps

Based on code analysis, these scenarios may need more test coverage:

1. **Multiple inheritance**: How methods are resolved
2. **Property vs method edge cases**: All combinations tested?
3. **Deeply nested attribute access**: `a.b.c.d.method()`
4. **Circular imports**: How handled?
5. **Dynamic class creation**: `type()` calls
6. **Monkey patching**: Methods added at runtime
7. **Lambda in various contexts**: Assigned, passed as arg, returned
8. **Generator expressions**: In various positions
9. **Walrus operator**: `:=` in conditions
10. **Pattern matching**: `match`/`case` statements (Python 3.10+)

---

## See Also

- [Configuration](CONFIGURATION.md) - Current configuration options
- [Type Tracking](TYPE_TRACKING.md) - Type resolution limitations
- [Node Types](NODE_TYPES.md) - What's currently supported

