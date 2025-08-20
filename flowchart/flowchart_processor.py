import ast
import os
import html
import re

class FlowchartProcessor:
    """
    Core flowchart processing logic for generating Mermaid JS flowcharts.
    """

    def __init__(self):
        self.nodes = {}
        self.connections = []
        self.click_handlers = []
        self.node_counter = 0
        self.loop_stack = []
        self.call_stack = []
        self.end_id = None
        self.function_defs = {}
        self.context_data = {} # For docstrings and variables
        self.tooltip_data = {} # Data to be exported as JSON
        self.node_scopes = {}  # Track which scope each node belongs to
        self.scope_children = {}  # Map parent scope to called function scopes
        self.breakpoint_lines = set()
        self.last_added_node = None
        
        # Read configuration from environment variables
        self.show_prints = os.environ.get('SHOW_PRINTS', '1') == '1'
        self.show_functions = os.environ.get('SHOW_FUNCTIONS', '1') == '1'
        self.show_for_loops = os.environ.get('SHOW_FOR_LOOPS', '1') == '1'
        self.show_while_loops = os.environ.get('SHOW_WHILE_LOOPS', '1') == '1'
        self.show_variables = os.environ.get('SHOW_VARIABLES', '1') == '1'
        self.show_ifs = os.environ.get('SHOW_IFS', '1') == '1'
        self.show_imports = os.environ.get('SHOW_IMPORTS', '1') == '1'
        self.show_exceptions = os.environ.get('SHOW_EXCEPTIONS', '1') == '1'
        self.show_returns = os.environ.get('SHOW_RETURNS', '1') == '1'

        # Track whether we've already rendered an import node
        self._first_import_rendered = False

    def set_breakpoints(self, lines):
        self.breakpoint_lines = set(lines)

    def _should_highlight_breakpoint(self, node):
        if node and hasattr(node, 'lineno'):
            return node.lineno in self.breakpoint_lines
        return False

    def _generate_id(self, prefix="node"):
        self.node_counter += 1
        return f"{prefix}{self.node_counter}"

    def _add_node(self, node_id, text, shape=('["', '"]'), scope=None):
        # Check if this node should be highlighted as a breakpoint
        if self._should_highlight_breakpoint(self.last_added_node):
            # Add breakpoint styling to the node text
            text = f"🔴 {text}" if text != " " else ""
        sanitized_text = html.escape(text, quote=False) \
                             .replace('"', '#quot;') \
                             .replace('!', '!')
        self.nodes[node_id] = f'{node_id}{shape[0]}{sanitized_text}{shape[1]}'
        self.node_scopes[node_id] = scope
        
        # If we are in a function's scope, add its context to the tooltip
        if scope and scope in self.context_data:
            self.click_handlers.append(f"click {node_id} setClickedNode")
            # Use html.escape on the context data itself for safe rendering
            docstring_html = html.escape(self.context_data[scope]['docstring'])
            variables_html = html.escape(", ".join(self.context_data[scope]['variables']))
            self.tooltip_data[node_id] = (
                f"<h4>Context: {scope}()</h4>"
                f"<p><strong>Docstring:</strong> {docstring_html or 'N/A'}</p>"
                f"<p><strong>Variables in scope:</strong> {variables_html or 'None'}</p>"
            )

    def _add_connection(self, from_id, to_id, label=""):
        if from_id is None or to_id is None:
            return
        if label:
            self.connections.append(f'    {from_id} -->|{label}| {to_id}')
        else:
            self.connections.append(f'    {from_id} --> {to_id}')

    def _get_node_text(self, node):
        text = ast.unparse(node).strip()
        
        if "'" in text and '"' not in text:
            text = text.replace("'", '"')
        text = self._simplify_data_structure(text, node)
        
        if len(text) >= 80:
            text = text[:77] + "..."

        return text

    def _simplify_data_structure(self, text, node=None):
        """Simplify complex data structures to readable representations."""

        var_name = None
        if node and hasattr(node, 'targets') and node.targets:
            target = node.targets[0]
            if isinstance(target, ast.Name):
                var_name = target.id
        elif node and hasattr(node, 'target'):
            # For AugAssign
            if isinstance(node.target, ast.Name):
                var_name = node.target.id

        if node and hasattr(node, 'value'):
            if isinstance(node.value, (ast.List, ast.Dict, ast.Tuple, ast.Set)):
                name = var_name or "var"
                if isinstance(node.value, ast.List):
                    # Check if list contains dictionaries or other complex types
                    nested_types = self._get_nested_types(node.value)
                    if nested_types:
                        return f'{name} = List[{nested_types}]'
                    else:
                        return f'{name} = List'
                elif isinstance(node.value, ast.Dict):
                    # Check if dict values are complex
                    nested_types = self._get_nested_types(node.value)
                    if nested_types:
                        return f'{name} = Dict[{nested_types}]'
                    else:
                        return f'{name} = Dict'
                elif isinstance(node.value, ast.Tuple):
                    nested_types = self._get_nested_types(node.value)
                    if nested_types:
                        return f'{name} = Tuple[{nested_types}]'
                    else:
                        return f'{name} = Tuple'
                elif isinstance(node.value, ast.Set):
                    nested_types = self._get_nested_types(node.value)
                    if nested_types:
                        return f'{name} = Set[{nested_types}]'
                    else:
                        return f'{name} = Set'

        return text

    def _get_nested_types(self, node):
        """Get the nested data types as a string representation."""
        types = set()
        elements = []
        if isinstance(node, ast.List) or isinstance(node, ast.Tuple) or isinstance(node, ast.Set):
            elements = node.elts
        elif isinstance(node, ast.Dict):
            elements = node.values
        for elt in elements:
            if isinstance(elt, (ast.List, ast.Tuple, ast.Set, ast.Dict)):
                types.add(type(elt).__name__)
            elif isinstance(elt, ast.Constant):
                types.add(type(elt.value).__name__)
        return ", ".join(sorted(types)) if types else None
    

    def _extract_context(self, tree):
        """
        Pre-pass to accurately extract docstrings and variables for each function,
        ensuring context does not leak between scopes.
        """
        for function_node in ast.walk(tree):
            if isinstance(function_node, ast.FunctionDef):
                # Get the docstring
                docstring = ast.get_docstring(function_node) or ""
                
                # --- FIX: Accurately find variables ONLY in the current function's scope ---
                variables = set()
                # 1. Add function arguments to variables
                for arg in function_node.args.args:
                    variables.add(arg.arg)
                    
                # 2. Walk the function's body to find assignments
                for body_item in function_node.body:
                    for node in ast.walk(body_item):
                        if isinstance(node, ast.Assign):
                            for target in node.targets:
                                if isinstance(target, ast.Name):
                                    variables.add(target.id)
                        elif isinstance(node, ast.AugAssign):
                            if isinstance(node.target, ast.Name):
                                variables.add(node.target.id)

                self.context_data[function_node.name] = {
                    "docstring": docstring,
                    "variables": sorted(list(variables))
                }

    def _process_node_list(self, nodes, prev_id, scope):
        current_id = prev_id
        for index, node in enumerate(nodes):
            if current_id is None: 
                break
            
            # --- FIX: Identify and SKIP docstring nodes from being rendered ---
            is_docstring = (
                index == 0 and
                isinstance(node, ast.Expr) and
                isinstance(node.value, ast.Constant) and
                isinstance(node.value.value, str)
            )
            if is_docstring:
                continue # Do not process this node, effectively making it invisible
            
            # Apply filters based on configuration
            if not self._filter_for_loops(node):
                continue
            if not self._filter_while_loops(node):
                continue
            if not self._filter_variables(node):
                continue
            if not self._filter_ifs(node):
                continue
            if not self._filter_exceptions(node):
                continue
            if not self._filter_returns(node):
                continue
            
            self.last_added_node = node
            handler_name = f"_handle_{type(node).__name__.lower()}"
            handler = getattr(self, handler_name, self._handle_unsupported)
            new_id = handler(node, current_id, scope)

            if current_id == new_id:
                continue

            current_id = new_id
        return current_id

    def _filter_for_loops(self, node):
        # If show_for_loops is False, filter out for loops
        if not self.show_for_loops and isinstance(node, ast.For):
            return False
        return True

    def _filter_while_loops(self, node):
        # If show_while_loops is False, filter out while loops
        if not self.show_while_loops and isinstance(node, ast.While):
            return False
        return True

    def _filter_variables(self, node):
        # If show_variables is False, filter out variable assignments and augmented assignments
        if not self.show_variables and (isinstance(node, ast.Assign) or isinstance(node, ast.AugAssign)):
            return False
        return True

    def _filter_ifs(self, node):
        # If show_ifs is False, filter out if statements
        if not self.show_ifs and isinstance(node, ast.If):
            return False
        return True

    def _filter_imports(self, node):
        # If show_imports is False, filter out import statements
        if not self.show_imports and isinstance(node, (ast.Import, ast.ImportFrom)):
            return False
        return True

    def _filter_exceptions(self, node):
        # If show_exceptions is False, filter out try/except blocks
        if not self.show_exceptions and isinstance(node, ast.Try):
            return False
        return True

    def _filter_returns(self, node):
        # If show_returns is False, filter out return statements
        if not self.show_returns and isinstance(node, ast.Return):
            return False
        return True
    
    def _filter_main_guard(self, node):
        if isinstance(node, ast.If):
            if '__name__ == "__main__"' in self._get_node_text(node.test):
                return False
        return True

    def _handle_if(self, node, prev_id, scope):
        # FIX: Add "If:" prefix
        condition_text = self._get_node_text(node.test)
        if len(condition_text) > 30:  # Adjust this limit as needed
            condition_text = condition_text[:27] + "..."
        text = f"If: {condition_text}"
        cond_id = self._generate_id("if_cond")
        self._add_node(cond_id, text, shape=('{"', '"}'), scope=scope)
        self._add_connection(prev_id, cond_id)
        
        merge_id = self._generate_id("merge")
        self._add_node(merge_id, " ", shape=('{{', '}}')) # No scope for merge nodes

        # Process true path
        true_path_end = self._process_node_list(node.body, cond_id, scope)
        if true_path_end:
            self._add_connection(true_path_end, merge_id)
        
        # Process false path (else clause)
        if node.orelse:
            false_path_end = self._process_node_list(node.orelse, cond_id, scope)
            if false_path_end:
                self._add_connection(false_path_end, merge_id)
        else:
            if not self._filter_main_guard(node):
                return merge_id
            # If no else clause, connect condition directly to merge
            self._add_connection(cond_id, merge_id, label="False")
        
        return merge_id

    def _handle_for(self, node, prev_id, scope):
        # FIX: Use {{"..."}} shape for robustness
        text = f"For Loop: {self._get_node_text(node.target)} in {self._get_node_text(node.iter)}"
        loop_cond_id = self._generate_id("for_loop")
        self._add_node(loop_cond_id, text, shape=('{{"', '"}}'), scope=scope)
        self._add_connection(prev_id, loop_cond_id)
        
        loop_exit_id = self._generate_id("loop_exit")
        self._add_node(loop_exit_id, " ", shape=('{{', '}}'))
        self.loop_stack.append({'start': loop_cond_id, 'exit': loop_exit_id})
        
        # Process loop body and get the last node
        body_end_id = self._process_node_list(node.body, loop_cond_id, scope)
        
        # Always connect back to loop condition for iteration
        # If body_end_id exists, use it; otherwise connect condition to itself
        if body_end_id and body_end_id != loop_cond_id:
            self._add_connection(body_end_id, loop_cond_id, label="Next Iteration")

        
        self.loop_stack.pop()
        # Connect loop condition to exit when done
        self._add_connection(loop_cond_id, loop_exit_id, label="Done")
        
        return loop_exit_id

    def _handle_expr(self, node, prev_id, scope):
        if isinstance(node.value, ast.Call):

            call = node.value
            func_name = getattr(call.func, 'id', None)
            
            # Check for attribute calls like sys.exit()
            if func_name is None and hasattr(call.func, 'attr'):
                attr_name = call.func.attr
                if hasattr(call.func, 'value') and hasattr(call.func.value, 'id'):
                    module_name = call.func.value.id
                    full_name = f"{module_name}.{attr_name}"
                    if full_name in ['sys.exit', 'os._exit']:
                        return self._handle_exit_function(node, prev_id, scope)
            
            # Check for direct function names
            if func_name in ['exit', 'quit']:
                return self._handle_exit_function(node, prev_id, scope)

            # Handle print statements and other function calls
            if func_name == 'print':
                if not self.show_prints:
                    return prev_id
                
                # Create a simple print node
                print_id = self._generate_id("print")
                self._add_node(print_id, self._get_node_text(node), shape=('["', '"]'), scope=scope)
                self._add_connection(prev_id, print_id)
                return print_id
            
            if not self.show_functions:
                return prev_id

            # Handle other function calls
            if func_name and func_name in self.function_defs:
                # Track nesting relationship between scopes
                self.scope_children.setdefault(scope, set()).add(func_name)
                function_node = self.function_defs[func_name]
                
                # For direct function calls (not assignments), show the call node
                call_id = self._generate_id(f"call_{func_name}")
                text = f"Call: {self._get_node_text(node)}"
                if self._should_highlight_breakpoint(node):
                    text = f"🔴 {text}" if text else ""
                self._add_node(call_id, text, shape=('[["', '"]]'), scope=scope)
                self._add_connection(prev_id, call_id)
                
                end_call_id = self._generate_id("end_call")
                self._add_node(end_call_id, " ", shape=('{{', '}}'))
                self.call_stack.append(end_call_id)
                # When we enter a function, the scope changes to that function's name
                body_end_id = self._process_node_list(function_node.body, call_id, scope=func_name)
                self.call_stack.pop()
                if body_end_id:
                    self._add_connection(body_end_id, end_call_id)
                return end_call_id

        # Handle other expressions
        expr_id = self._generate_id("expr")
        shape = ('[["', '"]]') if isinstance(node.value, ast.Call) else ('["', '"]')
        self._add_node(expr_id, self._get_node_text(node), shape=shape, scope=scope)
        self._add_connection(prev_id, expr_id)
        return expr_id
    
    def _handle_while(self, node, prev_id, scope):
        loop_cond_id = self._generate_id("while_loop")
        self._add_node(loop_cond_id, f"While {self._get_node_text(node.test)}", shape=('{"', '"}'), scope=scope)
        self._add_connection(prev_id, loop_cond_id)
        
        loop_exit_id = self._generate_id("loop_exit")
        self._add_node(loop_exit_id, " ", shape=('{{', '}}'))
        self.loop_stack.append({'start': loop_cond_id, 'exit': loop_exit_id})
        
        # Process loop body
        body_end_id = self._process_node_list(node.body, loop_cond_id, scope)
        
        # Always connect back to loop condition for iteration
        # If body_end_id exists, use it; otherwise connect condition to itself
        if body_end_id and body_end_id != loop_cond_id:
            # Connect body end back to loop condition for iteration
            self._add_connection(body_end_id, loop_cond_id, label="Next Iteration")
        else:
            # If no body or body loops back to same node, create self-loop
            self._add_connection(loop_cond_id, loop_cond_id, label="Next Iteration")
        
        self.loop_stack.pop()
        # Connect loop condition to exit when condition is false
        self._add_connection(loop_cond_id, loop_exit_id, label="Done")
        
        return loop_exit_id

    def _handle_return(self, node, prev_id, scope):
        return_id = self._generate_id("return")
        text = self._get_node_text(node) if node.value else "return"
        self._add_node(return_id, text, scope=scope)
        self._add_connection(prev_id, return_id)
        if self.call_stack: self._add_connection(return_id, self.call_stack[-1])
        else: self._add_connection(return_id, self.end_id)
        return None

    def _handle_assign(self, node, prev_id, scope):
        # Check if the right-hand side is a function call
        if len(node.targets) == 1 and isinstance(node.value, ast.Call):
            if not self.show_functions:
                return prev_id

            call = node.value
            func_name = getattr(call.func, 'id', None)
            
            if func_name and func_name in self.function_defs:
                # This is a function call assignment, expand it
                assign_id = self._generate_id("assign")
                self._add_node(assign_id, self._get_node_text(node), scope=scope)
                self._add_connection(prev_id, assign_id)
                
                # Track nesting relationship between scopes
                self.scope_children.setdefault(scope, set()).add(func_name)
                function_node = self.function_defs[func_name]
                end_call_id = self._generate_id("end_call")
                self._add_node(end_call_id, " ", shape=('{{', '}}'))
                self.call_stack.append(end_call_id)
                # When we enter a function, the scope changes to that function's name
                body_end_id = self._process_node_list(function_node.body, assign_id, scope=func_name)
                self.call_stack.pop()
                if body_end_id: 
                    self._add_connection(body_end_id, end_call_id)
                return end_call_id
        
        # Regular assignment
        assign_id = self._generate_id("assign")
        self._add_node(assign_id, self._get_node_text(node), scope=scope)
        self._add_connection(prev_id, assign_id)
        return assign_id

    def _handle_augassign(self, node, prev_id, scope):
        """Handle augmented assignments like count += 1, x *= 2, etc."""
        augassign_id = self._generate_id("augassign")
        # Get the operator symbol
        op_symbol = self._get_operator_symbol(node.op)
        # Format: "count += 1" or "x *= 2"
        text = f"{self._get_node_text(node.target)} {op_symbol} {self._get_node_text(node.value)}"
        self._add_node(augassign_id, text, scope=scope)
        self._add_connection(prev_id, augassign_id)
        return augassign_id

    def _get_operator_symbol(self, op):
        """Convert AST operator to string symbol"""
        op_map = {
            ast.Add: '+',
            ast.Sub: '-',
            ast.Mult: '*',
            ast.Div: '/',
            ast.Mod: '%',
            ast.Pow: '**',
            ast.LShift: '<<',
            ast.RShift: '>>',
            ast.BitOr: '|',
            ast.BitXor: '^',
            ast.BitAnd: '&',
            ast.FloorDiv: '//'
        }
        return op_map.get(type(op), str(op))

    def _handle_import(self, node, prev_id, scope):
        """Handle import statements like 'import os'"""
        # If we've already added an import, skip further imports
        if not self.show_imports:
            return prev_id
        if self._first_import_rendered:
            # Add "..." to the previous node to indicate more imports
            if prev_id in self.nodes:
                current_text = self.nodes[prev_id]
                if '...' not in current_text:
                    self.nodes[prev_id] = current_text.replace('"\]', '\n..."\]')
            return prev_id
        names = [alias.name for alias in node.names]
        text = f"import {', '.join(names)}"
        import_id = self._generate_id("import")
        self._add_node(import_id, text, shape=('[/"', r'"\]'), scope=scope)
        self._add_connection(prev_id, import_id)
        self._first_import_rendered = True
        return import_id

    def _handle_importfrom(self, node, prev_id, scope):
        """Handle from imports like 'from os import path'"""
        # If we've already added an import, skip further imports
        if not self.show_imports:
            return prev_id
        if self._first_import_rendered:
            return prev_id
        module = node.module or ""
        names = [alias.name for alias in node.names]
        text = f"from {module} import {', '.join(names)}"
        importfrom_id = self._generate_id("importfrom")
        self._add_node(importfrom_id, text, shape=('[/"', r'\"\]'), scope=scope)
        self._add_connection(prev_id, importfrom_id)
        self._first_import_rendered = True
        return importfrom_id

    def _handle_unsupported(self, node, prev_id, scope):
        unsupported_id = self._generate_id("unsupported")
        self._add_node(unsupported_id, f"Unsupported Node: {type(node).__name__}", shape=('[/"', r'\"\]'), scope=scope)
        self._add_connection(prev_id, unsupported_id)
        return unsupported_id

    def _handle_break(self, node, prev_id, scope):
        if self.loop_stack: self._add_connection(prev_id, self.loop_stack[-1]['exit'])
        return None

    def _handle_continue(self, node, prev_id, scope):
        if self.loop_stack: self._add_connection(prev_id, self.loop_stack[-1]['start'])
        return None

    def _handle_exit_function(self, node, prev_id, scope):
        """Handle functions that exit the current function/program."""
        exit_id = self._generate_id("exit_function")
        
        # Create exit node
        text = f"Exit: {self._get_node_text(node)}"
        self._add_node(exit_id, text, shape=('[/"', r'"\]'), scope=scope)
        self._add_connection(prev_id, exit_id)
        
        # Exit nodes don't connect to anything - they just end the flow
        # No connections needed
        
        return None  # No further processing after exit

    def process_code(self, python_code):
        """Process Python code and generate the initial flowchart structure."""
        try:
            print("=== Starting flowchart processing ===")
            tree = ast.parse(python_code)
            self._extract_context(tree)

            start_id = self._generate_id("start")
            self._add_node(start_id, "Start", shape=('[', ']'))
            self.end_id = self._generate_id("end")
            self._add_node(self.end_id, "End", shape=('[', ']'))

            main_flow_nodes = []
            for node in tree.body:
                if isinstance(node, ast.FunctionDef):
                    self.function_defs[node.name] = node
                else:
                    main_flow_nodes.append(node)

            # Process main flow nodes starting from start_id
            current_id = start_id
            for node in main_flow_nodes:
                handler_name = f"_handle_{type(node).__name__.lower()}"
                handler = getattr(self, handler_name, self._handle_unsupported)
                self.last_added_node = node
                current_id = handler(node, current_id, scope=None)

            # Connect the last node to end
            if current_id and current_id != start_id:
                self._add_connection(current_id, self.end_id)

            print("=== Flowchart processing completed successfully ===")
            return True

        except Exception as e:
            error_message = f"Error processing code: {e.__class__.__name__} - {e}"
            print(f"ERROR: {error_message}")
            return False
