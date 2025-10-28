import ast
import os
import html
import re
import logging
from typing import Dict, List, Set, Optional, Any, Union
from .config import FlowchartConfig
from . import handlers

# Configure logging
logger = logging.getLogger(__name__)

class FlowchartProcessor:
    """
    Core flowchart processing logic for generating Mermaid JS flowcharts.
    """

    def __init__(self):
        # Core data structures
        self.nodes = {}
        self.connections = []
        self.node_scopes = {}
        self.scope_children = {}
        
        # Processing state
        self.node_counter = 0
        self.loop_stack = []
        self.call_stack = []
        self.end_id = None
        self.last_added_node = None
        self.next_node_label = None

        # Function definitions and context
        self.function_defs = {}
        self.class_defs = {} # Added for class definitions - format: {class_name: {"node": class_node, "methods": {method_name: method_node}}}
        self.context_data = {}
        
        # Variable type tracking for method resolution
        self.variable_types = {} # Track variable types: {var_name: class_name}
        
        # Parameter type tracking for resolving attribute access
        # Format: {scope: {param_name: class_name}}
        self.parameter_types = {}
        
        # Attribute type tracking for resolving self.attribute access
        # Format: {scope: {attr_name: class_name}}
        self.attribute_types = {}

        # Recursion tracking
        self.recursive_calls = {}  # Track recursive function calls
        self.function_start_nodes = {}  # Track function start nodes for recursion loops

        # Nesting depth tracking
        self.current_nesting_depth = 0  # Track current function call nesting depth

        # Method exit tracking for sequential flow mode
        self.method_exit_nodes = {}  # Maps method_scope to exit node IDs

        # Workspace context and import tracking
        self.workspace_root = os.environ.get('WORKSPACE_ROOT') or None
        self.imported_modules = {}
        self.imported_symbols = {}
        self.external_definitions_cache = {}
        self.view_mode = 'advanced'

        # Configuration and display settings
        self.breakpoint_lines = set()
        self._first_import_rendered = False
        self._load_display_config()
        
        # Register handlers using Strategy Pattern
        self._register_handlers()

    def _load_display_config(self):
        """Load display configuration from environment variables."""
        config_map = {
            'show_prints': 'SHOW_PRINTS',
            'show_functions': 'SHOW_FUNCTIONS', 
            'show_for_loops': 'SHOW_FOR_LOOPS',
            'show_while_loops': 'SHOW_WHILE_LOOPS',
            'show_variables': 'SHOW_VARIABLES',
            'show_ifs': 'SHOW_IFS',
            'show_imports': 'SHOW_IMPORTS',
            'show_exceptions': 'SHOW_EXCEPTIONS',
            'show_returns': 'SHOW_RETURNS',
            'show_classes': 'SHOW_CLASSES',
            'merge_common_nodes': 'MERGE_COMMON_NODES',
            'sequential_flow': 'SEQUENTIAL_FLOW'
        }
        
        for attr, env_var in config_map.items():
            # Sequential flow defaults to False (traditional Call and Return mode)
            if attr == 'sequential_flow':
                setattr(self, attr, os.environ.get(env_var, '0') == '1')
            else:
                setattr(self, attr, os.environ.get(env_var, '1') == '1')

        view_mode = (os.environ.get('FLOWCHART_VIEW') or self.view_mode or 'advanced').lower()
        if view_mode not in {'calls', 'simple', 'advanced'}:
            view_mode = 'advanced'
        self.view_mode = view_mode

        env_root = os.environ.get('WORKSPACE_ROOT')
        if env_root:
            self.workspace_root = env_root

    def _register_handlers(self):
        """Register all node handlers using Strategy Pattern."""
        self.handlers = {
            ast.If: handlers.IfHandler(self),
            ast.For: handlers.ForHandler(self),
            ast.While: handlers.WhileHandler(self),
            ast.Expr: handlers.ExprHandler(self),
            ast.Return: handlers.ReturnHandler(self),
            ast.Assign: handlers.AssignHandler(self),
            ast.AugAssign: handlers.AugAssignHandler(self),
            ast.Import: handlers.ImportHandler(self),
            ast.ImportFrom: handlers.ImportFromHandler(self),
            ast.Break: handlers.BreakHandler(self),
            ast.Continue: handlers.ContinueHandler(self),
            ast.Try: handlers.TryHandler(self),
            ast.Raise: handlers.RaiseHandler(self),
            ast.With: handlers.WithHandler(self),
            ast.Assert: handlers.AssertHandler(self),
            ast.Pass: handlers.PassHandler(self),
            ast.Lambda: handlers.LambdaHandler(self),
            ast.ListComp: handlers.ComprehensionHandler(self),
            ast.DictComp: handlers.ComprehensionHandler(self),
            ast.SetComp: handlers.ComprehensionHandler(self),
            ast.GeneratorExp: handlers.ComprehensionHandler(self),
            ast.FunctionDef: handlers.FunctionDefHandler(self),
            ast.ClassDef: handlers.ClassHandler(self),
            'exit_function': handlers.ExitFunctionHandler(self),
            'print': handlers.PrintHandler(self),
            'method': handlers.MethodHandler(self),
            'property': handlers.PropertyHandler(self)
        }
        self.default_handler = handlers.UnsupportedHandler(self)

    # ===== NODE MANAGEMENT METHODS =====
    
    def _generate_id(self, prefix="node"):
        """Generate unique node ID."""
        self.node_counter += 1
        return f"{prefix}{self.node_counter}"

    def _add_node(self, node_id, text, shape=('["', '"]'), scope=None):
        """Add a node to the flowchart with max node limit check."""
        if len(self.nodes) >= FlowchartConfig.MAX_NODES:
            # Don't create any more connections if max nodes exceeded
            return False
        
        # Add breakpoint highlighting
        if self._should_highlight_breakpoint(self.last_added_node):
            text = f"🔴 {text}" if text != " " else ""

        sanitized_text = text.replace('<', '&lt').replace('>', '&gt').replace('"', "'")
        self.nodes[node_id] = f'{node_id}{shape[0]}{sanitized_text}{shape[1]}'
        self.node_scopes[node_id] = scope
        return True

    def _add_connection(self, from_id, to_id, label="", bidirectional=False):
        """Add connection between nodes with fallback handling."""
        if from_id is None or to_id is None:
            return

        if not label and self.next_node_label:
            label = self.next_node_label
            self.next_node_label = None

        # Handle node object fallback for max nodes exceeded
        if hasattr(from_id, 'lineno') and self.nodes:
            from_id = list(self.nodes.keys())[-1]
        
        # In sequential flow mode, force unidirectional arrows
        if self.sequential_flow:
            bidirectional = False
        
        if bidirectional:
            # Create bidirectional connection with arrows pointing both ways
            connection = f'    {from_id} <-->|{label}| {to_id}' if label else f'    {from_id} <--> {to_id}'
        else:
            connection = f'    {from_id} -->|{label}| {to_id}' if label else f'    {from_id} --> {to_id}'
        self.connections.append(connection)

    # ===== IMPORT AND EXTERNAL CALL HELPERS =====

    def register_module_import(self, alias):
        module_name = alias.name
        alias_name = alias.asname or module_name.split('.')[0]
        module_path = self._resolve_module_path(module_name)
        if alias_name:
            self.imported_modules[alias_name] = {
                'module': module_name,
                'path': module_path
            }
        # Store full module reference for prefix matching
        self.imported_modules[module_name] = {
            'module': module_name,
            'path': module_path
        }

    def register_symbol_import(self, module_name, alias):
        if not module_name:
            return
        symbol_name = alias.asname or alias.name
        module_path = self._resolve_module_path(module_name)
        self.imported_symbols[symbol_name] = {
            'module': module_name,
            'original': alias.name,
            'path': module_path
        }

    def _resolve_module_path(self, module_name):
        if not module_name or not self.workspace_root:
            return None

        parts = module_name.split('.')
        file_candidate = os.path.join(self.workspace_root, *parts) + '.py'
        if os.path.exists(file_candidate):
            return file_candidate

        package_init = os.path.join(self.workspace_root, *parts, '__init__.py')
        if os.path.exists(package_init):
            return package_init

        return None

    def _ensure_external_definitions_loaded(self, file_path):
        if not file_path:
            return

        if file_path in self.external_definitions_cache:
            return

        names = set()
        try:
            with open(file_path, 'r', encoding='utf-8') as handle:
                tree = ast.parse(handle.read())
            for node in ast.walk(tree):
                if isinstance(node, ast.FunctionDef):
                    names.add(node.name)
                elif isinstance(node, ast.ClassDef):
                    names.add(node.name)
        except Exception as exc:
            logger.debug("Failed to parse external module %s: %s", file_path, exc)
        self.external_definitions_cache[file_path] = names

    def _external_symbol_exists(self, file_path, symbol_name):
        if not file_path or not symbol_name:
            return False
        self._ensure_external_definitions_loaded(file_path)
        names = self.external_definitions_cache.get(file_path, set())
        return symbol_name in names

    def _get_full_attribute_name(self, func_node):
        parts = []
        current = func_node
        while isinstance(current, ast.Attribute):
            parts.append(current.attr)
            current = current.value
        if isinstance(current, ast.Name):
            parts.append(current.id)
        else:
            return None
        parts.reverse()
        return '.'.join(parts)

    def resolve_external_call(self, call_node):
        if not isinstance(call_node, ast.Call):
            return None

        func = call_node.func

        if isinstance(func, ast.Name):
            symbol = func.id
            info = self.imported_symbols.get(symbol)
            if info and info.get('path') and self._external_symbol_exists(info['path'], info['original']):
                return {
                    'file_path': info['path'],
                    'function': info['original'],
                    'module': info['module'],
                    'alias': symbol
                }

        full_attr = self._get_full_attribute_name(func) if isinstance(func, ast.Attribute) else None
        if not full_attr:
            return None

        parts = full_attr.split('.')
        alias = parts[0]
        remainder = parts[1:]

        module_info = self.imported_modules.get(alias)
        if module_info and remainder:
            module_name = module_info['module']
            module_path = module_info.get('path') or self._resolve_module_path(module_name)
            function_name = remainder[-1]
            if module_path and self._external_symbol_exists(module_path, function_name):
                return {
                    'file_path': module_path,
                    'function': function_name,
                    'module': module_name,
                    'alias': alias
                }

        for alias_key, info in self.imported_modules.items():
            module_name = info['module']
            if full_attr.startswith(module_name + '.'):
                module_path = info.get('path') or self._resolve_module_path(module_name)
                function_name = full_attr[len(module_name) + 1:].split('.')[-1]
                if module_path and self._external_symbol_exists(module_path, function_name):
                    return {
                        'file_path': module_path,
                        'function': function_name,
                        'module': module_name,
                        'alias': alias_key
                    }

        return None

    def format_external_call_label(self, target_info):
        file_path = target_info.get('file_path')
        function_name = target_info.get('function')
        module_name = target_info.get('module')

        display_path = file_path
        if self.workspace_root and file_path:
            try:
                display_path = os.path.relpath(file_path, self.workspace_root)
            except ValueError:
                display_path = file_path

        if display_path and function_name:
            return f"External: {display_path}::{function_name}"
        if function_name:
            return f"External: {function_name}"
        if display_path:
            return f"External: {display_path}"
        return f"External: {module_name or 'unknown'}"

    # ===== TEXT PROCESSING METHODS =====
    
    def _get_node_text(self, node):
        """Get simplified text representation of a node."""
        text = ast.unparse(node).strip()
        text = text.replace("'", '"') if "'" in text and '"' not in text else text
        text = self._simplify_data_structure(text, node)
        
        # Replace quotes with backticks for print statements to avoid Mermaid parsing issues
        if isinstance(node, ast.Expr) and isinstance(node.value, ast.Call):
            if hasattr(node.value.func, 'id') and node.value.func.id == 'print':
                text = text.replace('"', '`').replace("'", '`')
        
        if len(text) >= FlowchartConfig.NODE_LIMITS['max_text_length']:
            text = text[:FlowchartConfig.NODE_LIMITS['max_text_length'] - 3] + "..."
        
        return text

    def _simplify_data_structure(self, text, node=None):
        """Simplify complex data structures to readable representations."""
        if not node or not hasattr(node, 'value'):
            return text
        
        var_name = self._extract_variable_name(node)
        if not var_name:
            return text
        
        if isinstance(node.value, (ast.List, ast.Dict, ast.Tuple, ast.Set)):
            nested_types = self._get_nested_types(node.value)
            type_name = type(node.value).__name__
            return f'{var_name} = {type_name}[{nested_types}]' if nested_types else f'{var_name} = {type_name}'
        
        return text

    def _extract_variable_name(self, node):
        """Extract variable name from assignment node."""
        if hasattr(node, 'targets') and node.targets:
            target = node.targets[0]
            return target.id if isinstance(target, ast.Name) else None
        elif hasattr(node, 'target') and isinstance(node.target, ast.Name):
            return node.target.id
        return None

    def _get_nested_types(self, node):
        """Get nested data types as string representation."""
        elements = getattr(node, 'elts', []) if hasattr(node, 'elts') else getattr(node, 'values', [])
        types = set()
        
        for elt in elements:
            if isinstance(elt, (ast.List, ast.Tuple, ast.Set, ast.Dict)):
                types.add(type(elt).__name__)
            elif isinstance(elt, ast.Constant):
                types.add(type(elt.value).__name__)
        
        return ", ".join(sorted(types)) if types else None

    def _get_operator_symbol(self, op):
        """Convert AST operator to string symbol."""
        op_map = {
            ast.Add: '+', ast.Sub: '-', ast.Mult: '*', ast.Div: '/',
            ast.Mod: '%', ast.Pow: '**', ast.LShift: '<<', ast.RShift: '>>',
            ast.BitOr: '|', ast.BitXor: '^', ast.BitAnd: '&', ast.FloorDiv: '//'
        }
        return op_map.get(type(op), str(op))

    # ===== CONTEXT EXTRACTION METHODS =====
    
    def _extract_context(self, tree):
        """Extract docstrings and variables for each function."""
        for function_node in ast.walk(tree):
            if isinstance(function_node, ast.FunctionDef):
                docstring = ast.get_docstring(function_node) or ""
                variables = self._extract_function_variables(function_node)
                self.context_data[function_node.name] = {
                    "docstring": docstring,
                    "variables": sorted(list(variables))
                }

    def _extract_function_variables(self, function_node):
        """Extract variables from function definition."""
        variables = set()
        
        # Add function arguments
        for arg in function_node.args.args:
            variables.add(arg.arg)
        
        # Add variables from assignments in function body
        for body_item in function_node.body:
            for node in ast.walk(body_item):
                if isinstance(node, ast.Assign):
                    for target in node.targets:
                        if isinstance(target, ast.Name):
                            variables.add(target.id)
                elif isinstance(node, ast.AugAssign) and isinstance(node.target, ast.Name):
                    variables.add(node.target.id)
        
        return variables

    # ===== NODE FILTERING METHODS =====
    
    def _should_process_node(self, node, index):
        """Check if node should be processed based on filters and type."""
        # Skip docstring nodes
        if self._is_docstring_node(node, index):
            return False
        
        # Skip function definitions - they should not appear as nodes in the flowchart
        # Function definitions are stored separately for function calls and context data
        if isinstance(node, ast.FunctionDef):
            return False
        
        # Allow class definitions to be processed (they create subgraphs but don't connect to main flow)
        # Class definitions are handled by ClassHandler
        
        # Allow method body nodes to be processed (they create nodes within method subgraphs)
        # Method body nodes are processed by _process_method_body
        
        # Apply type-based filters
        filter_methods = [
            self._filter_for_loops,
            self._filter_while_loops,
            self._filter_variables,
            self._filter_ifs,
            self._filter_exceptions,
            self._filter_returns,
            self._filter_classes
        ]
        
        return all(filter_method(node) for filter_method in filter_methods)

    def _is_docstring_node(self, node, index):
        """Check if node is a docstring."""
        return (index == 0 and 
                isinstance(node, ast.Expr) and 
                isinstance(node.value, ast.Constant) and 
                isinstance(node.value.value, str))

    def _filter_for_loops(self, node):
        return self.show_for_loops or not isinstance(node, ast.For)
    
    def _filter_classes(self, node):
        return self.show_classes or not isinstance(node, ast.ClassDef)

    def _filter_while_loops(self, node):
        return self.show_while_loops or not isinstance(node, ast.While)

    def _filter_variables(self, node):
        return self.show_variables or not isinstance(node, (ast.Assign, ast.AugAssign))

    def _filter_ifs(self, node):
        return self.show_ifs or not isinstance(node, ast.If)

    def _filter_exceptions(self, node):
        return self.show_exceptions or not isinstance(node, ast.Try)

    def _filter_returns(self, node):
        return self.show_returns or not isinstance(node, ast.Return)

    def _filter_classes(self, node):
        return self.show_classes or not isinstance(node, ast.ClassDef)

    def _filter_main_guard(self, node):
        """Filter out main guard if statements."""
        if isinstance(node, ast.If):
            return '__name__ == "__main__"' not in self._get_node_text(node.test)
        return True

    # ===== NODE PROCESSING METHODS =====
    
    def _process_node_list(self, nodes, prev_id, scope, next_node_label=None):
        """Process a list of nodes using the strategy pattern."""
        current_id = prev_id
        # Set next node label for the first node
        if next_node_label is not None:
            self.next_node_label = next_node_label
        
        # Track function start node for recursion detection
        if scope and scope in self.function_defs and current_id not in self.function_start_nodes.values():
            self.function_start_nodes[scope] = current_id
        
        for index, node in enumerate(nodes):
            if current_id is None:
                break
            
            if not self._should_process_node(node, index):
                continue
            
            self.last_added_node = node
            handler : handlers.NodeHandler = self.handlers.get(type(node), self.default_handler)
            new_id = handler.handle(node, current_id, scope)

            # Reset next node label after the first node
            self.next_node_label = None

            if current_id == new_id:
                continue
            
            # Handle max nodes limit
            if new_id is False:
                self._handle_max_nodes_exceeded(current_id)
                break
            
            # Handle None return (end of flow)
            if new_id is None:
                break

            current_id = new_id
        
        return current_id

    def _handle_max_nodes_exceeded(self, current_id):
        """Handle case when max nodes limit is exceeded."""
        if current_id and hasattr(self, 'end_id') and self.end_id:
            self._add_connection(current_id, self.end_id, 
                               f"Max node limit {FlowchartConfig.MAX_NODES} exceeded")

    # ===== BREAKPOINT METHODS =====
    
    def set_breakpoints(self, lines):
        """Set breakpoint lines for highlighting."""
        self.breakpoint_lines = set(lines)

    def _should_highlight_breakpoint(self, node):
        """Check if node should be highlighted as breakpoint."""
        return node and hasattr(node, 'lineno') and node.lineno in self.breakpoint_lines

    def _is_recursive_call(self, func_name, current_scope):
        """Check if a function call is recursive (calling itself)."""
        return func_name == current_scope

    def _get_function_start_node(self, func_name):
        """Get the start node ID for a function (first node in function body)."""
        if func_name in self.function_start_nodes:
            return self.function_start_nodes[func_name]
        return None

    def _is_nesting_limit_exceeded(self):
        """Check if the current nesting depth exceeds the maximum allowed."""
        return self.current_nesting_depth >= FlowchartConfig.MAX_NESTING_DEPTH

    # ===== MAIN PROCESSING METHOD =====
    
    def process_code(self, python_code):
        """Main method to process Python code and generate flowchart."""
        try:
            print("=== Starting flowchart processing ===")
            
            # Parse and setup
            tree = ast.parse(python_code)
            self._extract_context(tree)
            
            # Create start and end nodes
            start_id = self._generate_id("start")
            self._add_node(start_id, "Start", shape=FlowchartConfig.SHAPES['start'])
            self.end_id = self._generate_id("end")
            self._add_node(self.end_id, "End", shape=FlowchartConfig.SHAPES['end'])

            # Separate function definitions from main flow
            main_flow_nodes = [node for node in tree.body if not isinstance(node, ast.FunctionDef)]
            for node in tree.body:
                if isinstance(node, ast.FunctionDef):
                    self.function_defs[node.name] = node
                elif isinstance(node, ast.ClassDef):
                    # Store class with methods structure
                    methods = {}
                    for item in node.body:
                        if isinstance(item, ast.FunctionDef):
                            methods[item.name] = item
                    self.class_defs[node.name] = {
                        "node": node,
                        "methods": methods
                    }

            # Process main flow
            current_id = self._process_main_flow(start_id, main_flow_nodes)
            
            # Connect to end if needed
            if current_id and current_id != start_id and current_id is not False:
                # Check if this is a method call node with a tracked last node
                # If so, use the last node inside the method for end connection
                if hasattr(self, 'method_last_nodes') and current_id in self.method_last_nodes:
                    end_node = self.method_last_nodes[current_id]
                    if end_node and end_node != current_id:
                        self._add_connection(end_node, self.end_id)
                    else:
                        self._add_connection(current_id, self.end_id)
                else:
                    self._add_connection(current_id, self.end_id)

            print("=== Flowchart processing completed successfully ===")
            return True

        except Exception as e:
            error_message = f"Error processing code: {e.__class__.__name__} - {e}"
            print(f"ERROR: {error_message}")
            return False

    def _process_main_flow(self, start_id, main_flow_nodes):
        """Process the main flow of nodes."""
        current_id = start_id
        
        for node in main_flow_nodes:
            handler = self.handlers.get(type(node), self.default_handler)
            self.last_added_node = node
            
            # Set main scope for nodes in the main flow
            # Check if the handler's handle method accepts a scope parameter
            try:
                current_id = handler.handle(node, current_id, scope="main")
            except TypeError:
                # Handler doesn't accept scope parameter, call without it
                current_id = handler.handle(node, current_id)
            
            if current_id is False:  # Max nodes limit hit
                break
            elif current_id is None:  # Handler handled the flow completely (e.g., main guard)
                break
        
        return current_id

