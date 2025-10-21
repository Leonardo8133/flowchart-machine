# Type Tracking System

## Overview

The type tracking system enables the processor to **resolve method calls** by tracking the types of variables, parameters, and attributes throughout code execution. This allows accurate visualization of object-oriented code.

## Why Type Tracking?

### The Problem

```python
class Calculator:
    def add(self, a, b):
        return a + b

calc = Calculator()
result = calc.add(2, 3)  # Which add() method? What class?
```

Without type tracking, the processor can't determine:
- What type `calc` is
- Which class's `add()` method to call
- Where to create the method subgraph

### The Solution

Type tracking maintains three dictionaries:

1. **Variable Types**: `{'calc': 'Calculator'}`
2. **Parameter Types**: `{'class_Service___init__': {'db': 'Database'}}`
3. **Attribute Types**: `{'class_Service': {'db': 'Database'}}`

---

## Variable Type Tracking

### Purpose

Track the types of **variables** in the main flow and function scopes.

### Data Structure

```python
self.variable_types = {
    'calc': 'Calculator',
    'user': 'User',
    'service': 'UserService',
    'db': 'Database'
}
```

**Key**: Variable name  
**Value**: Class name

### When Tracked

#### Class Instantiation

```python
# In AssignHandler._handle_class_instantiation_assignment:
if len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
    var_name = node.targets[0].id  # 'calc'
    self.processor.variable_types[var_name] = class_name  # 'Calculator'
```

**Example**:
```python
calc = Calculator()
# Tracks: variable_types['calc'] = 'Calculator'
```

#### Method Call Assignment

```python
service = UserService(db)
# Tracks: variable_types['service'] = 'UserService'
```

### When Used

#### Method Resolution

```python
result = calc.add(2, 3)
# 1. Parse call: object='calc', method='add'
# 2. Look up: variable_types['calc'] -> 'Calculator'
# 3. Resolve: Calculator.add() method
# 4. Create: Method subgraph for Calculator.add()
```

**Code** (in `AssignHandler._resolve_object_type`):
```python
if isinstance(obj_node, ast.Name):
    var_name = obj_node.id  # 'calc'
    if var_name in self.processor.variable_types:
        return self.processor.variable_types[var_name]  # 'Calculator'
```

---

## Parameter Type Tracking

### Purpose

Track the types of **parameters** within function/method scopes.

### Data Structure

```python
self.parameter_types = {
    'class_UserService___init__': {
        'db': 'Database',
        'config': 'Config'
    },
    'class_PaymentService___init__': {
        'payment_processor': 'PaymentProcessor'
    }
}
```

**Key**: Scope name (e.g., `class_ClassName_methodName`)  
**Value**: Dictionary mapping parameter names to class names

### When Tracked

#### Class Instantiation with Arguments

```python
service = UserService(db)
# Tracks: parameter_types['class_UserService___init__']['db'] = 'Database'
#         (if db's type is known from variable_types)
```

**Code** (in `AssignHandler._handle_class_instantiation_assignment`):
```python
# Get parameter names from __init__ (skip 'self')
param_names = [arg.arg for arg in method_node.args.args[1:]]
# Get arguments passed to the call
call_args = node.value.args

# Map parameters to their types
method_scope = f"class_{class_name}___init__"
if method_scope not in self.processor.parameter_types:
    self.processor.parameter_types[method_scope] = {}

for i, arg in enumerate(call_args):
    if i < len(param_names):
        param_name = param_names[i]
        # Check if argument is a variable with known type
        if isinstance(arg, ast.Name) and arg.id in self.processor.variable_types:
            arg_type = self.processor.variable_types[arg.id]
            self.processor.parameter_types[method_scope][param_name] = arg_type
```

### When Used

#### Method Resolution in Methods

```python
class UserService:
    def __init__(self, db):
        self.db = db  # See attribute tracking
    
    def get_user(self, user_id):
        self.db.connect()  # Needs to resolve db's type
```

**Resolution**:
1. In `get_user`, `self.db` is accessed
2. Look up attribute types for `class_UserService`
3. Find `db` attribute has type `Database`
4. Resolve `Database.connect()` method

---

## Attribute Type Tracking

### Purpose

Track the types of **object attributes** (especially `self.attribute`).

### Data Structure

```python
self.attribute_types = {
    'class_UserService___init__': {
        'db': 'Database',
        'cache': 'Cache'
    },
    'class_PaymentService___init__': {
        'payment_processor': 'PaymentProcessor'
    }
}
```

**Key**: Scope name where attribute is assigned  
**Value**: Dictionary mapping attribute names to class names

### When Tracked

#### Attribute Assignment in Methods

```python
class UserService:
    def __init__(self, db):
        self.db = db  # Tracks attribute type
```

**Code** (in `AssignHandler.handle`):
```python
# Track attribute assignments like self.db = db
if len(node.targets) == 1 and isinstance(node.targets[0], ast.Attribute):
    target_attr = node.targets[0]
    # Check if it's self.attribute
    if isinstance(target_attr.value, ast.Name) and target_attr.value.id == 'self':
        attr_name = target_attr.attr  # 'db'
        # Check if the value is a parameter with known type
        if isinstance(node.value, ast.Name):
            param_name = node.value.id  # 'db'
            # Look up parameter type in current scope
            if scope in self.processor.parameter_types and param_name in self.processor.parameter_types[scope]:
                param_type = self.processor.parameter_types[scope][param_name]  # 'Database'
                if scope not in self.processor.attribute_types:
                    self.processor.attribute_types[scope] = {}
                self.processor.attribute_types[scope][attr_name] = param_type
```

### When Used

#### Attribute Method Resolution

```python
class UserService:
    def __init__(self, db):
        self.db = db  # Tracked: attribute_types['class_UserService___init__']['db'] = 'Database'
    
    def get_user(self, user_id):
        self.db.connect()  # Resolves: Database.connect()
```

**Resolution Code** (in `AssignHandler._resolve_object_type`):
```python
if isinstance(obj_node, ast.Attribute):
    # Check if it's self.attribute
    if isinstance(obj_node.value, ast.Name) and obj_node.value.id == 'self':
        attr_name = obj_node.attr  # 'db'
        
        # Try current scope first
        if scope in self.processor.attribute_types and attr_name in self.processor.attribute_types[scope]:
            return self.processor.attribute_types[scope][attr_name]
        
        # If not found, look up in class __init__ scope
        if scope and scope.startswith("class_"):
            parts = scope.split("_")
            if len(parts) >= 3:  # class_ClassName_methodName
                class_name = parts[1]  # 'UserService'
                init_scope = f"class_{class_name}___init__"  # 'class_UserService___init__'
                if init_scope in self.processor.attribute_types and attr_name in self.processor.attribute_types[init_scope]:
                    return self.processor.attribute_types[init_scope][attr_name]
```

**Key Points**:
1. First checks **current scope** for attribute
2. Falls back to **class `__init__` scope** (where attributes are typically set)

---

## Type Resolution Flow

### Complete Example

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

# Main flow
db = Database()
service = UserService(db)
user = service.get_user(123)
```

### Tracking Steps

#### Step 1: Track `db` Variable Type

```python
db = Database()
```

**Tracked**:
```python
variable_types['db'] = 'Database'
```

---

#### Step 2: Track `db` Parameter Type

```python
service = UserService(db)
```

**Call Analysis**:
- `UserService.__init__` has parameter `db`
- Argument `db` is a variable with known type `'Database'`

**Tracked**:
```python
parameter_types['class_UserService___init__']['db'] = 'Database'
```

---

#### Step 3: Track `self.db` Attribute Type

```python
class UserService:
    def __init__(self, db):
        self.db = db  # Inside UserService.__init__
```

**Assignment Analysis**:
- Scope: `'class_UserService___init__'`
- Attribute: `self.db`
- Value: `db` (parameter)
- Parameter type: `'Database'`

**Tracked**:
```python
attribute_types['class_UserService___init__']['db'] = 'Database'
```

---

#### Step 4: Track `service` Variable Type

```python
service = UserService(db)
```

**Tracked**:
```python
variable_types['service'] = 'UserService'
```

---

#### Step 5: Resolve `service.get_user()`

```python
user = service.get_user(123)
```

**Resolution**:
1. Object: `service`
2. Look up: `variable_types['service']` → `'UserService'`
3. Method: `get_user`
4. Look up: `UserService.get_user` in `class_defs`
5. Create: Method subgraph for `UserService.get_user()`

---

#### Step 6: Resolve `self.db.connect()`

```python
def get_user(self, user_id):
    self.db.connect()  # Inside UserService.get_user()
```

**Resolution**:
1. Scope: `'class_UserService_get_user'`
2. Object: `self.db`
3. Extract class: `'UserService'`
4. Look up attribute in `__init__`: `attribute_types['class_UserService___init__']['db']` → `'Database'`
5. Method: `connect`
6. Look up: `Database.connect` in `class_defs`
7. Create: Method subgraph for `Database.connect()`

---

## Property vs Method Differentiation

### Property Access

**Behavior**: Validates that a property exists but doesn't create a node.

**Example**:
```python
class User:
    def __init__(self, name):
        self.name = name

user = User("John")
print(user.name)  # Property access - validated
```

**Validation** (in `PropertyHandler`):
```python
def _property_exists(self, class_name, property_name):
    # Check if property is set in __init__
    init_scope = f"class_{class_name}___init__"
    if init_scope in self.processor.attribute_types:
        if property_name in self.processor.attribute_types[init_scope]:
            return True
    return False
```

**Error Node**:
```python
print(user.age)  # age doesn't exist
# Creates: ❌ Property 'age' not found in User
```

---

### Method Call

**Behavior**: Creates a method call node and method subgraph.

**Example**:
```python
class User:
    def get_info(self):
        return self.name

user = User("John")
info = user.get_info()  # Method call - creates subgraph
```

**Validation** (in `MethodHandler`):
```python
def handle_method_call(self, node, prev_id, scope, method_name, class_name=None, call_obj=None):
    # Check if method exists in class
    if method_name in class_info["methods"]:
        # Create method subgraph
        ...
    else:
        # Check if it's a property mistakenly called as method
        if self._is_class_property(class_name, method_name):
            error_text = f"⚠️ '{method_name}' is a property, not a method"
        else:
            error_text = f"❌ Method '{method_name}' not found in {class_name}"
```

---

## Type Resolution Edge Cases

### Unresolved Variables

**Problem**: Variable type not tracked.

```python
obj = some_function()  # Return type unknown
obj.method()  # Can't resolve class
```

**Result**:
```
❌ Could not resolve class for method 'method'
```

---

### Static Method Calls

**Direct Class Access**:
```python
Calculator.add(2, 3)
```

**Resolution**:
```python
# In _resolve_object_type:
if var_name in self.processor.class_defs:
    return var_name  # 'Calculator'
```

**Works Because**: Class names are checked in `class_defs`.

---

### Nested Attribute Access

**Problem**: `obj.attr.method()` requires recursive type resolution.

```python
service.db.connect()
# Needs: service -> UserService
#        service.db -> Database
#        Database.connect()
```

**Current Implementation**: Only resolves `self.attribute`, not general `obj.attribute`.

**Limitation**: 
```python
service.db.connect()  # Works (if db is self.db in UserService)
obj1.obj2.method()    # May not resolve
```

---

### Parameter Type Propagation

**Tracked**:
```python
def __init__(self, db):
    self.db = db  # db type tracked if known
```

**Not Tracked**:
```python
def process(db):
    db.connect()  # db type not tracked (not in __init__)
```

**Workaround**: Only parameters to `__init__` are tracked.

---

## Type Tracking Limitations

### 1. No Runtime Type Information

The processor analyzes **static code**, not runtime execution:

```python
obj = get_dynamic_object()  # Type unknown
obj.method()  # Can't resolve
```

---

### 2. No Control Flow Analysis

Type tracking doesn't follow control flow:

```python
if condition:
    obj = Calculator()
else:
    obj = Database()

obj.method()  # Which class? Unknown
```

**Current Behavior**: Last assignment wins.

---

### 3. No List/Dict Element Tracking

Collections don't track element types:

```python
services = [UserService(db), PaymentService(pp)]
service = services[0]
service.method()  # Type unknown
```

---

### 4. No Type Inference from Literals

Literals don't infer types:

```python
name = "John"  # Not tracked as str
count = 42     # Not tracked as int
```

**Only Tracked**: Class instantiations.

---

## Best Practices

### 1. Assign to Variables

```python
# Good: Type tracked
service = UserService(db)
service.get_user(123)

# Bad: Type not tracked
UserService(db).get_user(123)
```

---

### 2. Use `__init__` for Attributes

```python
# Good: Attribute type tracked
class Service:
    def __init__(self, db):
        self.db = db
    
    def method(self):
        self.db.connect()  # Type resolved

# Bad: Attribute not tracked
class Service:
    def setup(self, db):
        self.db = db  # Not in __init__, may not track
```

---

### 3. Pass Objects with Known Types

```python
# Good: db type is known
db = Database()
service = UserService(db)

# Bad: arg type unknown
service = UserService(get_db())
```

---

## Debugging Type Tracking

### View Variable Types

```python
print(processor.variable_types)
# {'calc': 'Calculator', 'service': 'UserService', ...}
```

### View Parameter Types

```python
print(processor.parameter_types)
# {'class_UserService___init__': {'db': 'Database'}, ...}
```

### View Attribute Types

```python
print(processor.attribute_types)
# {'class_UserService___init__': {'db': 'Database', 'cache': 'Cache'}, ...}
```

---

## See Also

- [Node Types](NODE_TYPES.md) - How types are tracked during processing
- [Connections](CONNECTIONS.md) - How resolved types create connections
- [Subgraphs](SUBGRAPHS.md) - Method subgraph creation from resolved types

