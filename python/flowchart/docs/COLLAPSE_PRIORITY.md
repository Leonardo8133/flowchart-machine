# Subgraph Collapse Priority System

## Overview

The flowchart generator implements a sophisticated priority system for controlling which subgraphs should be collapsed or expanded. This allows fine-grained control over the visualization complexity.

## Priority Order

The system evaluates rules in the following order (highest priority first):

### 1. Force Collapse EXACT Match (Highest Priority)
If a scope name **exactly matches** an entry in the force collapse list, it will **always be collapsed**, regardless of any other rules.

**Example:**
```python
FORCE_COLLAPSE_LIST = 'class_TestClass_test_method'
# Result: The method `test_method` in `TestClass` will be collapsed
```

### 2. Whitelist EXACT Match
If a scope name **exactly matches** an entry in the whitelist, it will **never be collapsed** (unless overridden by Force Collapse Exact).

**Example:**
```python
SUBGRAPH_WHITELIST = 'class_TestClass_other_method'
# Result: The method `other_method` in `TestClass` will be expanded
```

### 3. Entry Point Protection
The entry point (function, class, or method where flowchart generation starts) is **automatically protected** from collapsing to ensure the starting point is always visible.

### 4. Force Collapse PATTERN Match
If a scope's **extracted class name** matches an entry in the force collapse list, it will be collapsed.

**Example:**
```python
FORCE_COLLAPSE_LIST = 'TestClass_test_method'
# Pattern extraction: 'class_TestClass_test_method' → 'TestClass_test_method'
# Result: Matches and will be collapsed
```

**Note:** The pattern is extracted by removing the `class_` prefix from scope names like `class_TestClass_test_method`.

### 5. Whitelist PATTERN Match
If a scope's **extracted class name** matches an entry in the whitelist, it will be expanded.

**Example:**
```python
SUBGRAPH_WHITELIST = 'TestClass'
# Pattern match: 'class_TestClass', 'class_TestClass_test_method', 'class_TestClass___init__' all match
# Result: All TestClass-related subgraphs will be expanded
```

### 6. Size-Based (Lowest Priority)
If none of the above rules apply, subgraphs are collapsed based on their node count exceeding `MAX_SUBGRAPH_NODES`.

**Default:** `MAX_SUBGRAPH_NODES = 25`

**Example:**
```python
MAX_SUBGRAPH_NODES = '10'
# Result: Any subgraph with more than 10 nodes will be collapsed
```

---

## Configuration

### Environment Variables

```bash
# Maximum nodes before auto-collapse
export MAX_SUBGRAPH_NODES=25

# Comma-separated list of scopes to always expand
export SUBGRAPH_WHITELIST='UserService,Database'

# Comma-separated list of scopes to always collapse
export FORCE_COLLAPSE_LIST='class_UserService___init__,class_Database_query'
```

### Scope Naming Convention

Scopes follow this pattern:
- **Class:** `class_ClassName`
- **Method:** `class_ClassName_method_name`
- **Function:** `function_name`

---

## Use Cases

### Use Case 1: Expand Parent Class, Collapse Specific Methods

**Goal:** Keep the `UserService` class expanded, but collapse large helper methods.

**Configuration:**
```bash
SUBGRAPH_WHITELIST='UserService'
FORCE_COLLAPSE_LIST='class_UserService_helper_method,class_UserService___init__'
```

**Result:**
- ✅ `UserService` class is expanded (whitelist pattern)
- ❌ `UserService.__init__()` is collapsed (force collapse exact beats whitelist pattern)
- ❌ `UserService.helper_method()` is collapsed (force collapse exact beats whitelist pattern)
- ✅ Other `UserService` methods are expanded (whitelist pattern applies)

---

### Use Case 2: Collapse Entire Class

**Goal:** Hide all implementation details of a class.

**Configuration:**
```bash
FORCE_COLLAPSE_LIST='class_Database'
```

**Result:**
- ❌ The entire `Database` class and all its methods are collapsed (force collapse exact + pattern)

---

### Use Case 3: Protect Specific Method from Collapse

**Goal:** Always show a critical method, even if parent class is force collapsed.

**Configuration:**
```bash
FORCE_COLLAPSE_LIST='UserService'
SUBGRAPH_WHITELIST='class_UserService_authenticate'
```

**Result:**
- ❌ Most `UserService` methods are collapsed (force collapse pattern)
- ✅ `UserService.authenticate()` is expanded (whitelist exact beats force collapse pattern)

---

### Use Case 4: Size-Based with Exceptions

**Goal:** Auto-collapse large subgraphs, but keep specific classes always expanded.

**Configuration:**
```bash
MAX_SUBGRAPH_NODES='15'
SUBGRAPH_WHITELIST='Database'
```

**Result:**
- ❌ Any subgraph with >15 nodes is collapsed automatically
- ✅ `Database` class and all its methods are always expanded (whitelist overrides size)

---

## Testing

The priority system is thoroughly tested in `tests/test_classes.py`:

```python
# Test 1: Force collapse exact beats whitelist pattern
test_whitelist_force_collapse_priority()

# Test 2: Force collapse exact beats whitelist pattern
test_exact_match_priority()

# Test 3: Whitelist exact beats force collapse pattern
test_whitelist_exact_over_force_pattern()
```

Run tests:
```bash
python -m unittest tests.test_classes.TestFlowchartClasses.test_whitelist_force_collapse_priority -v
python -m unittest tests.test_classes.TestFlowchartClasses.test_exact_match_priority -v
python -m unittest tests.test_classes.TestFlowchartClasses.test_whitelist_exact_over_force_pattern -v
```

---

## Implementation Details

The priority logic is implemented in `post_processor.py`:

```python
def _is_subgraph_too_large(self, scope):
    """Check if a subgraph should be collapsed based on priority rules."""
    
    # 1. Force collapse EXACT match
    if scope in FlowchartPostProcessor.force_collapse_list:
        return True
    
    # 2. Whitelist EXACT match
    if scope in FlowchartPostProcessor.subgraph_whitelist:
        return False
    
    # 3. Entry point protection
    if hasattr(self, 'entry_name') and self.entry_name and scope == self.entry_name:
        return False
    
    # 4 & 5. Extract class name for pattern matching
    class_name = None
    if scope.startswith("class_") and len(scope) > 6:
        class_name = scope[6:]
    
    # 4. Force collapse PATTERN match
    if class_name and class_name in FlowchartPostProcessor.force_collapse_list:
        return True
    
    # 5. Whitelist PATTERN match
    if class_name and class_name in FlowchartPostProcessor.subgraph_whitelist:
        return False
    
    # 6. Size-based
    max_subgraph_nodes = int(os.getenv('MAX_SUBGRAPH_NODES', FlowchartConfig.MAX_SUBGRAPH_NODES))
    scope_nodes = [nid for nid, sc in self.processor.node_scopes.items() if sc == scope]
    return len(scope_nodes) > max_subgraph_nodes
```

---

## Summary

**Key Principles:**
1. **Exact matches beat pattern matches**
2. **Force collapse beats whitelist** (at the same specificity level)
3. **Entry points are always protected**
4. **Size-based is the fallback**

This allows you to be very specific (exact scope names) or broad (class patterns) in your collapse configuration, with a clear and predictable resolution order.

