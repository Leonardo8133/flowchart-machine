import ast
import os
import html
import re

class FlowchartConfig:
    """Configuration constants for flowchart generation."""
    
    SHAPES = {
        'start': ('[', ']'),
        'end': ('[', ']'),
        'condition': ('{"', '"}'),
        'loop': ('{{"', '"}}'),
        'merge': ('{{', '}}'),
        'print': ('["', '"]'),
        'function_call': ('[["', '"]]'),
        'import': ('[/"', r'"\]'),
        'exit': ('[/"', r'"\]'),
        'exception': ('[["', '"]]'),
        'finally': ('[/"', r'"\]'),
        'try': ('{"', '"}'),
        'catch': ('[["', '"]]'),
    }
    
    NODE_LIMITS = {
        'max_text_length': 80,
        'condition_truncate': 30
    }
    
    MAX_NODES = 100
    MAX_NESTING_DEPTH = 6  # Maximum number of nested function call layers
    MAX_SUBGRAPH_NODES = 25  # Maximum nodes before subgraph becomes collapsible
    
    EXIT_FUNCTIONS = ['sys.exit', 'os._exit', 'exit', 'quit']

class NodeHandler:
    """Base class for node handlers using Strategy Pattern."""
    
    def __init__(self, processor):
        self.processor : FlowchartProcessor = processor
    
    def handle(self, node, prev_id, scope):
        """Handle a specific node type. Must be implemented by subclasses."""
        raise NotImplementedError("Subclasses must implement handle method")
    
    def _should_consolidate_with_previous(self, prev_id, scope):
        """Check if we should consolidate with the previous node."""

        if not self.processor.merge_common_nodes:
            return False

        if not prev_id or prev_id not in self.processor.nodes:
            return False
        
        prev_node_def = self.processor.nodes[prev_id]
        prev_scope = self.processor.node_scopes.get(prev_id)
        
        # Check if previous node is in same scope
        if prev_scope != scope:
            return False
        
        # Don't consolidate with control flow nodes (if, for, while, etc.)
        if any(keyword in prev_node_def for keyword in ['If:', 'For Loop:', 'While', 'Call:', 'return']):
            return False
        
        # Check if previous node is a print statement
        if 'print(' in prev_node_def:
            return True
        
        # Check if previous node is a simple assignment (no function calls)
        if self._is_simple_assignment(prev_node_def):
            return True
        
        # Check if previous node is an augmented assignment
        if '=' in prev_node_def and ('+=' in prev_node_def or '-=' in prev_node_def or 
                                    '*=' in prev_node_def or '/=' in prev_node_def or 
                                    '%=' in prev_node_def or '**=' in prev_node_def or 
                                    '//=' in prev_node_def or '&=' in prev_node_def or 
                                    '|=' in prev_node_def or '^=' in prev_node_def or 
                                    '<<=' in prev_node_def or '>>=' in prev_node_def):
            return True
        
        return False
    
    def _can_consolidate_current_node(self, node):
        """Check if the current node can be consolidated."""
        # Only consolidate print statements and simple assignments
        if isinstance(node, ast.Expr) and isinstance(node.value, ast.Call):
            # Check if it's a print statement
            if hasattr(node.value.func, 'id') and node.value.func.id == 'print':
                return True
        
        # Check for simple assignments (no function calls)
        if isinstance(node, ast.Assign):
            # Check if the value is a simple expression (not a function call)
            if not isinstance(node.value, ast.Call):
                return True
        
        # Check for augmented assignments
        if isinstance(node, ast.AugAssign):
            # Check if the value is a simple expression (not a function call)
            if not isinstance(node.value, ast.Call):
                return True
        
        return False
    
    def _is_simple_assignment(self, node_def):
        """Check if a node is a simple assignment without function calls."""
        # Look for assignment patterns like "var = value" or "var += value"
        if '=' in node_def and not self._has_function_call(node_def):
            return True
        return False
    
    def _has_function_call(self, node_def):
        """Check if a node definition contains a function call."""
        return '(' in node_def and ')' in node_def
    
    def _consolidate_with_previous(self, node, prev_id, scope):
        """Consolidate this node with the previous one."""
        prev_text = self.processor.nodes[prev_id]
        prev_content = self._extract_text_from_node(prev_text)
        
        # Get current node's text
        current_text = self.processor._get_node_text(node)
        
        # Create consolidated text
        consolidated_text = f"{prev_content}\\n{current_text}"
        
        # Update the previous node with consolidated text
        self.processor.nodes[prev_id] = f'{prev_id}["{consolidated_text}"]'
        
        # Return the previous node ID since we're using it
        return prev_id
    
    def _extract_text_from_node(self, node_def):
        """Extract text content from a node definition."""
        start = node_def.find('[')
        end = node_def.rfind(']')
        if start != -1 and end != -1:
            text = node_def[start+1:end]
            # Remove outer quotes if present
            if text.startswith('"') and text.endswith('"'):
                text = text[1:-1]
            elif text.startswith("'") and text.endswith("'"):
                text = text[1:-1]
            # Replace all remaining quotes with backticks to avoid Mermaid parsing issues
            text = text.replace('"', '`').replace("'", '`')
            return text
        return ""

class IfHandler(NodeHandler):
    """Handle if statements."""
    
    def handle(self, node, prev_id, scope):
        condition_text = self.processor._get_node_text(node.test)
        if len(condition_text) > FlowchartConfig.NODE_LIMITS['condition_truncate']:
            condition_text = condition_text[:FlowchartConfig.NODE_LIMITS['condition_truncate'] - 3] + "..."
        text = f"If: {condition_text}"
        cond_id = self.processor._generate_id("if_cond")
        self.processor._add_node(cond_id, text, shape=FlowchartConfig.SHAPES['condition'], scope=scope)
        self.processor._add_connection(prev_id, cond_id)
        
        # Process true path
        true_path_end = self.processor._process_node_list(node.body, cond_id, scope)
        
        # Process false path (else clause)
        if node.orelse:
            # We have an else clause, so we need a merge node
            merge_id = self.processor._generate_id("merge")
            self.processor._add_node(merge_id, " ", shape=FlowchartConfig.SHAPES['merge'])
            
            if true_path_end:
                self.processor._add_connection(true_path_end, merge_id)
            
            false_path_end = self.processor._process_node_list(node.orelse, cond_id, scope)
            if false_path_end:
                self.processor._add_connection(false_path_end, merge_id)
            
            return merge_id
        else:
            # No else clause - check if this is a main guard
            if not self.processor._filter_main_guard(node):
                # This is a main guard (if __name__ == "__main__":)
                # Create a separate End node for the true path
                true_end_id = self.processor._generate_id("end")
                self.processor._add_node(true_end_id, "End", shape=FlowchartConfig.SHAPES['end'])
                
                if true_path_end:
                    # Connect true path to the new End node
                    self.processor._add_connection(true_path_end, true_end_id)
                # Connect false path to the original End node
                self.processor._add_connection(cond_id, self.processor.end_id, label="False")
                # Return None since both paths are handled
                return None
            else:
                # Simple if statement in method context - no merge node needed
                # The flow will continue naturally from the true path or condition
                if true_path_end:
                    return true_path_end
                else:
                    # If no true path, return the condition itself
                    return cond_id

class ForHandler(NodeHandler):
    """Handle for loops."""
    
    def handle(self, node, prev_id, scope):
        text = f"For Loop: {self.processor._get_node_text(node.target)} in {self.processor._get_node_text(node.iter)}"
        loop_cond_id = self.processor._generate_id("for_loop")
        self.processor._add_node(loop_cond_id, text, shape=FlowchartConfig.SHAPES['loop'], scope=scope)
        self.processor._add_connection(prev_id, loop_cond_id)
        
        loop_exit_id = self.processor._generate_id("loop_exit")
        self.processor._add_node(loop_exit_id, " ", shape=FlowchartConfig.SHAPES['merge'])
        self.processor.loop_stack.append({'start': loop_cond_id, 'exit': loop_exit_id})
        
        # Process loop body and get the last node
        body_end_id = self.processor._process_node_list(node.body, loop_cond_id, scope, next_node_label="Next Iteration")
        
        # Always connect back to loop condition for iteration
        if body_end_id and body_end_id != loop_cond_id:
            self.processor._add_connection(body_end_id, loop_cond_id, label="Next Iteration")
        
        self.processor.loop_stack.pop()
        # Connect loop condition to exit when done
        self.processor._add_connection(loop_cond_id, loop_exit_id, label="Done")
        
        return loop_exit_id

class WhileHandler(NodeHandler):
    """Handle while loops."""
    
    def handle(self, node, prev_id, scope):
        loop_cond_id = self.processor._generate_id("while_loop")
        self.processor._add_node(loop_cond_id, f"While {self.processor._get_node_text(node.test)}", shape=FlowchartConfig.SHAPES['condition'], scope=scope)
        self.processor._add_connection(prev_id, loop_cond_id)
        
        loop_exit_id = self.processor._generate_id("loop_exit")
        self.processor._add_node(loop_exit_id, " ", shape=FlowchartConfig.SHAPES['merge'])
        self.processor.loop_stack.append({'start': loop_cond_id, 'exit': loop_exit_id})
        
        # Process loop body
        body_end_id = self.processor._process_node_list(node.body, loop_cond_id, scope)
        
        # Always connect back to loop condition for iteration
        if body_end_id and body_end_id != loop_cond_id:
            self.processor._add_connection(body_end_id, loop_cond_id, label="Next Iteration")
        else:
            # If no body or body loops back to same node, create self-loop
            self.processor._add_connection(loop_cond_id, loop_cond_id, label="Next Iteration")
        
        self.processor.loop_stack.pop()
        # Connect loop condition to exit when condition is false
        self.processor._add_connection(loop_cond_id, loop_exit_id, label="Done")
        
        return loop_exit_id

class PrintHandler(NodeHandler):
    """Handle print statements."""
    
    def handle(self, node, prev_id, scope):
        if not self.processor.show_prints:
            return prev_id
        
        # Check if the previous node can be consolidated AND current node can be consolidated
        if self._should_consolidate_with_previous(prev_id, scope):
            return self._consolidate_with_previous(node, prev_id, scope)
        
        # Check if print has function calls as arguments or in f-strings
        if hasattr(node.value, 'args') and node.value.args:
            for arg in node.value.args:
                if isinstance(arg, ast.Call):
                    # Found a function call in print arguments, process it
                    return self._handle_print_with_function_calls(node, prev_id, scope)
                elif isinstance(arg, ast.JoinedStr):  # f-string
                    # Check if f-string contains function calls
                    if self._has_function_calls_in_fstring(arg):
                        return self._handle_print_with_function_calls(node, prev_id, scope)
        
        # Regular single print statement
        print_id = self.processor._generate_id("print")
        self.processor._add_node(print_id, self.processor._get_node_text(node), shape=FlowchartConfig.SHAPES['print'], scope=scope)
        self.processor._add_connection(prev_id, print_id)
        return print_id
    
    def _handle_print_with_function_calls(self, node, prev_id, scope):
        """Handle print statements that contain function calls in their arguments."""
        # Create print node with actual text
        print_id = self.processor._generate_id("print")
        print_text = self.processor._get_node_text(node)
        self.processor._add_node(print_id, print_text, shape=FlowchartConfig.SHAPES['print'], scope=scope)
        self.processor._add_connection(prev_id, print_id)
        
        current_id = print_id
        
        # Collect all function calls from arguments and f-strings
        function_calls = []
        for arg in node.value.args:
            if isinstance(arg, ast.Call):
                function_calls.append(arg)
            elif isinstance(arg, ast.JoinedStr):  # f-string
                function_calls.extend(self._extract_function_calls_from_fstring(arg))
        
        # Process each function call with unique call instances
        call_counter = {}
        for func_call in function_calls:
            func_name = getattr(func_call.func, 'id', None)
            if func_name and func_name in self.processor.function_defs:
                # Track call instances for unique subgraph names
                if func_name not in call_counter:
                    call_counter[func_name] = 0
                call_counter[func_name] += 1
                call_instance = call_counter[func_name]
                
                # Process the function call
                if self.processor._is_nesting_limit_exceeded():
                    # Create placeholder for nested function call
                    call_id = self.processor._generate_id(f"nesting_limit_{func_name}_{call_instance}")
                    text = f"Call: {self.processor._get_node_text(ast.Expr(value=func_call))} (Max nesting depth {FlowchartConfig.MAX_NESTING_DEPTH} exceeded)"
                    self.processor._add_node(call_id, text, shape=FlowchartConfig.SHAPES['function_call'], scope=scope)
                    self.processor._add_connection(current_id, call_id)
                    current_id = call_id
                else:
                    # Process the function call with unique scope
                    call_id = self.processor._generate_id(f"call_{func_name}_{call_instance}")
                    text = f"Call: {self.processor._get_node_text(ast.Expr(value=func_call))}"
                    self.processor._add_node(call_id, text, shape=FlowchartConfig.SHAPES['function_call'], scope=scope)
                    self.processor._add_connection(current_id, call_id)
                    
                    # Create unique scope for this call instance
                    unique_scope = f"{func_name}_call_{call_instance}"
                    
                    # Process function body with unique scope
                    function_node = self.processor.function_defs[func_name]
                    end_call_id = self.processor._generate_id("end_call")
                    self.processor._add_node(end_call_id, " ", shape=FlowchartConfig.SHAPES['merge'])
                    self.processor.call_stack.append(end_call_id)
                    
                    # Increment nesting depth
                    self.processor.current_nesting_depth += 1
                    body_end_id = self.processor._process_node_list(function_node.body, call_id, scope=unique_scope)
                    self.processor.current_nesting_depth -= 1
                    
                    self.processor.call_stack.pop()
                    if body_end_id:
                        self.processor._add_connection(body_end_id, end_call_id)
                    current_id = end_call_id
        
        return current_id
    
    def _has_function_calls_in_fstring(self, fstring_node):
        """Check if an f-string contains function calls."""
        for value in fstring_node.values:
            if isinstance(value, ast.FormattedValue):
                # Check if the expression inside {} is a function call
                if isinstance(value.value, ast.Call):
                    return True
                # Recursively check nested expressions
                for node in ast.walk(value.value):
                    if isinstance(node, ast.Call):
                        return True
        return False
    
    def _extract_function_calls_from_fstring(self, fstring_node):
        """Extract function calls from an f-string."""
        function_calls = []
        for value in fstring_node.values:
            if isinstance(value, ast.FormattedValue):
                # Check if the expression inside {} is a function call
                if isinstance(value.value, ast.Call):
                    function_calls.append(value.value)
                # Recursively find nested function calls
                for node in ast.walk(value.value):
                    if isinstance(node, ast.Call) and node != value.value:
                        function_calls.append(node)
        return function_calls

class ExprHandler(NodeHandler):
    """Handle expressions including function calls and class instantiation."""
    
    def handle(self, node, prev_id, scope):
        if isinstance(node.value, ast.Call):
            call = node.value
            func_name = getattr(call.func, 'id', None)
            
            # Check for attribute calls like sys.exit() or method calls like obj.method()
            if func_name is None and hasattr(call.func, 'attr'):
                attr_name = call.func.attr
                if hasattr(call.func, 'value') and hasattr(call.func.value, 'id'):
                    module_name = call.func.value.id
                    full_name = f"{module_name}.{attr_name}"
                    if full_name in FlowchartConfig.EXIT_FUNCTIONS:
                        return self.processor.handlers['exit_function'].handle(node, prev_id, scope)
                    
                    return self._handle_method_call(node, prev_id, scope, attr_name)
            
            # Check for direct function names
            if func_name in FlowchartConfig.EXIT_FUNCTIONS:
                return self.processor.handlers['exit_function'].handle(node, prev_id, scope)

            # Handle print statements and other function calls
            if func_name == 'print':
                return self.processor.handlers['print'].handle(node, prev_id, scope)
            
            # Handle class instantiation
            if func_name and func_name in self.processor.class_defs:
                if not self.processor.show_classes:
                    return prev_id
                
                return self._handle_class_instantiation(node, prev_id, scope, func_name)
               
            if not self.processor.show_functions:
                return prev_id

            # Handle other function calls
            if func_name and func_name in self.processor.function_defs:
                # Check if nesting limit is exceeded
                if self.processor._is_nesting_limit_exceeded():
                    # Create a placeholder node indicating nesting limit exceeded
                    call_id = self.processor._generate_id(f"nesting_limit_{func_name}")
                    text = f"Call: {self.processor._get_node_text(node)} (Max nesting depth {FlowchartConfig.MAX_NESTING_DEPTH} exceeded)"
                    if self.processor._should_highlight_breakpoint(node):
                        text = f"🔴 {text}" if text else ""
                    self.processor._add_node(call_id, text, shape=FlowchartConfig.SHAPES['function_call'], scope=scope)
                    self.processor._add_connection(prev_id, call_id)
                    return call_id
                
                # Check if this is a recursive call
                if self.processor._is_recursive_call(func_name, scope):
                    # Handle recursive call - create a loop back to function start
                    call_id = self.processor._generate_id(f"recursive_call_{func_name}")
                    text = f"Recursive Call: {self.processor._get_node_text(node)}"
                    if self.processor._should_highlight_breakpoint(node):
                        text = f"🔴 {text}" if text else ""
                    self.processor._add_node(call_id, text, shape=FlowchartConfig.SHAPES['function_call'], scope=scope)
                    self.processor._add_connection(prev_id, call_id)
                    
                    # Connect back to function start to create recursion loop
                    function_start = self.processor._get_function_start_node(func_name)
                    if function_start:
                        self.processor._add_connection(call_id, function_start, label="Recursion")
                        # Store this as a recursive call for later processing
                        if func_name not in self.processor.recursive_calls:
                            self.processor.recursive_calls[func_name] = []
                        self.processor.recursive_calls[func_name].append(call_id)
                    
                    return call_id
                else:
                    # Track nesting relationship between scopes
                    self.processor.scope_children.setdefault(scope, set()).add(func_name)
                    function_node = self.processor.function_defs[func_name]
                    
                    # For direct function calls (not assignments), show the call node
                    call_id = self.processor._generate_id(f"call_{func_name}")
                    text = f"Call: {self.processor._get_node_text(node)}"
                    if self.processor._should_highlight_breakpoint(node):
                        text = f"🔴 {text}" if text else ""
                    self.processor._add_node(call_id, text, shape=FlowchartConfig.SHAPES['function_call'], scope=scope)
                    self.processor._add_connection(prev_id, call_id)
                    
                    end_call_id = self.processor._generate_id("end_call")
                    self.processor._add_node(end_call_id, " ", shape=FlowchartConfig.SHAPES['merge'])
                    self.processor.call_stack.append(end_call_id)
                    
                    # Increment nesting depth before processing function body
                    self.processor.current_nesting_depth += 1
                    # When we enter a function, the scope changes to that function's name
                    body_end_id = self.processor._process_node_list(function_node.body, call_id, scope=func_name)
                    # Decrement nesting depth after processing function body
                    self.processor.current_nesting_depth -= 1
                    
                    self.processor.call_stack.pop()
                    if body_end_id:
                        self.processor._add_connection(body_end_id, end_call_id)
                    return end_call_id

        # Handle other expressions
        expr_id = self.processor._generate_id("expr")
        shape = FlowchartConfig.SHAPES['function_call'] if isinstance(node.value, ast.Call) else FlowchartConfig.SHAPES['print']
        if not self.processor._add_node(expr_id, self.processor._get_node_text(node), shape=shape, scope=scope):
            return False
        self.processor._add_connection(prev_id, expr_id)
        return expr_id
    
    def _handle_method_call(self, node, prev_id, scope, method_name):
        """Handle method calls on objects."""
        method_call_id = self.processor._generate_id("method_call")
        text = f"Call: {self.processor._get_node_text(node)}"
        self.processor._add_node(method_call_id, text, shape=FlowchartConfig.SHAPES['function_call'], scope=scope)
        self.processor._add_connection(prev_id, method_call_id)
        
        if not self.processor.show_classes:
            return method_call_id
        
        # Try to find the method definition and create a subgraph for it
        # Look through all class definitions to find this method
        for class_name, class_node in self.processor.class_defs.items():
            for item in class_node.body:
                if isinstance(item, ast.FunctionDef) and item.name == method_name:
                    self.processor.handlers[ast.ClassDef]._create_method_subgraph(class_name, method_name, item, method_call_id)
                    break
        
        return method_call_id
    
    def _handle_class_instantiation(self, node, prev_id, scope, class_name):
        """Handle class instantiation by connecting to the class's __init__ method."""
        # Create instantiation node
        instantiation_id = self.processor._generate_id("instantiate")
        text = f"Create: {self.processor._get_node_text(node)}"
        self.processor._add_node(instantiation_id, text, shape=FlowchartConfig.SHAPES['function_call'], scope=scope)
        self.processor._add_connection(prev_id, instantiation_id)
        
        # Find the class and connect to its __init__ method
        if class_name in self.processor.class_defs:
            class_node = self.processor.class_defs[class_name]
            # Look for __init__ method in the class
            for item in class_node.body:
                if isinstance(item, ast.FunctionDef) and item.name == '__init__':
                    # Create __init__ method subgraph and connect instantiation to it
                    self.processor.handlers[ast.ClassDef]._create_method_subgraph(class_name, '__init__', item, instantiation_id)
                    break
            else:
                # If no __init__ method found, connect to class node as fallback
                class_scope = f"class_{class_name}"
                class_nodes = [nid for nid, sc in self.processor.node_scopes.items() if sc == class_scope]
                if class_nodes:
                    class_node_id = class_nodes[0]
                    self.processor._add_connection(instantiation_id, class_node_id, label="Instantiate")
        
        return instantiation_id

class ReturnHandler(NodeHandler):
    """Handle return statements."""
    
    def handle(self, node, prev_id, scope):
        return_id = self.processor._generate_id("return")
        text = self.processor._get_node_text(node) if node.value else "return"
        self.processor._add_node(return_id, text, scope=scope)
        self.processor._add_connection(prev_id, return_id)
        
        # Check if return value contains a recursive function call
        if node.value and isinstance(node.value, ast.Call):
            func_name = getattr(node.value.func, 'id', None)
            if func_name and self.processor._is_recursive_call(func_name, scope):
                # This is a recursive return - create loop back to function start
                function_start = self.processor._get_function_start_node(scope)
                if function_start:
                    self.processor._add_connection(return_id, function_start, label="Recursion")
                    # Store this as a recursive call for later processing
                    if scope not in self.processor.recursive_calls:
                        self.processor.recursive_calls[scope] = []
                    self.processor.recursive_calls[scope].append(return_id)
                return None
        
        # Check if we're in a method scope (class_methodName)
        if scope and scope.startswith("class_") and "_" in scope[6:]:
            # We're in a method, connect back to the calling node
            if hasattr(self.processor, 'method_calling_nodes') and scope in self.processor.method_calling_nodes:
                calling_node = self.processor.method_calling_nodes[scope]
                self.processor._add_connection(return_id, calling_node, label="Return")
            else:
                # Fallback: don't connect anywhere, method just ends
                pass
        elif self.processor.call_stack:
            # We're in a function call, connect back to the call stack
            self.processor._add_connection(return_id, self.processor.call_stack[-1])
        else:
            # We're in the main flow, connect to end
            self.processor._add_connection(return_id, self.processor.end_id)
        
        return None

class AssignHandler(NodeHandler):
    """Handle assignments including function call assignments and class instantiation."""
    
    def handle(self, node, prev_id, scope):
        # Check if the right-hand side is a function call
        if len(node.targets) == 1 and isinstance(node.value, ast.Call):
            call = node.value
            func_name = getattr(call.func, 'id', None)
            
            # Handle class instantiation assignment
            if func_name and func_name in self.processor.class_defs:
                if not self.processor.show_classes:
                    return prev_id
                return self._handle_class_instantiation_assignment(node, prev_id, scope, func_name)
            
            # Handle method call assignment (like result = obj.method())
            if func_name is None and hasattr(call.func, 'attr'):
                if not self.processor.show_classes:
                    return prev_id

                attr_name = call.func.attr
                # This is a method call assignment
                return self._handle_method_call_assignment(node, prev_id, scope, attr_name)
            
            if not self.processor.show_functions:
                return prev_id

            if func_name and func_name in self.processor.function_defs:
                # Check if nesting limit is exceeded
                if self.processor._is_nesting_limit_exceeded():
                    # Create a placeholder assignment indicating nesting limit exceeded
                    assign_id = self.processor._generate_id("nesting_limit_assign")
                    text = f"{self.processor._get_node_text(node)}\n (Max nesting depth {FlowchartConfig.MAX_NESTING_DEPTH} exceeded)"
                    self.processor._add_node(assign_id, text, scope=scope)
                    self.processor._add_connection(prev_id, assign_id)
                    return assign_id
                
                # Check if this is a recursive call
                if self.processor._is_recursive_call(func_name, scope):
                    # Handle recursive call assignment - create a loop back to function start
                    assign_id = self.processor._generate_id("recursive_assign")
                    self.processor._add_node(assign_id, self.processor._get_node_text(node), scope=scope)
                    self.processor._add_connection(prev_id, assign_id)
                    
                    # Connect back to function start to create recursion loop
                    function_start = self.processor._get_function_start_node(func_name)
                    if function_start:
                        self.processor._add_connection(assign_id, function_start, label="Recursion")
                        # Store this as a recursive call for later processing
                        if func_name not in self.processor.recursive_calls:
                            self.processor.recursive_calls[func_name] = []
                        self.processor.recursive_calls[func_name].append(assign_id)
                    
                    return assign_id
                else:
                    # This is a function call assignment, expand it
                    assign_id = self.processor._generate_id("assign")
                    self.processor._add_node(assign_id, self.processor._get_node_text(node), scope=scope)
                    self.processor._add_connection(prev_id, assign_id)
                    
                    # Track nesting relationship between scopes
                    self.processor.scope_children.setdefault(scope, set()).add(func_name)
                    function_node = self.processor.function_defs[func_name]
                    end_call_id = self.processor._generate_id("end_call")
                    self.processor._add_node(end_call_id, " ", shape=FlowchartConfig.SHAPES['merge'])
                    self.processor.call_stack.append(end_call_id)
                    
                    # Increment nesting depth before processing function body
                    self.processor.current_nesting_depth += 1
                    # When we enter a function, the scope changes to that function's name
                    body_end_id = self.processor._process_node_list(function_node.body, assign_id, scope=func_name)
                    # Decrement nesting depth after processing function body
                    self.processor.current_nesting_depth -= 1
                    
                    self.processor.call_stack.pop()
                    if body_end_id: 
                        self.processor._add_connection(body_end_id, end_call_id)
                    return end_call_id
        
        # Regular assignment
        if self._should_consolidate_with_previous(prev_id, scope):
            return self._consolidate_with_previous(node, prev_id, scope)

        assign_id = self.processor._generate_id("assign")
        self.processor._add_node(assign_id, self.processor._get_node_text(node), scope=scope)
        self.processor._add_connection(prev_id, assign_id)
        return assign_id
    
    def _handle_method_call_assignment(self, node, prev_id, scope, method_name):
        """Handle method call assignment by creating method subgraph."""
        # Create assignment node
        assign_id = self.processor._generate_id("assign")
        self.processor._add_node(assign_id, self.processor._get_node_text(node), scope=scope)
        self.processor._add_connection(prev_id, assign_id)
        
        # Try to find the method definition and create a subgraph for it
        # Look through all class definitions to find this method
        for class_name, class_node in self.processor.class_defs.items():
            for item in class_node.body:
                if isinstance(item, ast.FunctionDef) and item.name == method_name:
                    # Found the method, create a subgraph for it
                    self.processor.handlers[ast.ClassDef]._create_method_subgraph(class_name, method_name, item, assign_id)
                    break
        
        return assign_id
    
    def _handle_class_instantiation_assignment(self, node, prev_id, scope, class_name):
        """Handle class instantiation assignment by connecting to the class's __init__ method."""
        # Create assignment node
        assign_id = self.processor._generate_id("assign")
        self.processor._add_node(assign_id, self.processor._get_node_text(node), scope=scope)
        self.processor._add_connection(prev_id, assign_id)
        
        # Find the class and connect to its __init__ method
        if class_name in self.processor.class_defs:
            class_node = self.processor.class_defs[class_name]
            # Look for __init__ method in the class
            for item in class_node.body:
                if isinstance(item, ast.FunctionDef) and item.name == '__init__':
                    # Create __init__ method subgraph and connect assignment to it
                    self.processor.handlers[ast.ClassDef]._create_method_subgraph(class_name, '__init__', item, assign_id)
                    # Delete the class node
                    break
        
        return assign_id

class AugAssignHandler(NodeHandler):
    """Handle augmented assignments like count += 1, x *= 2, etc."""
    
    def handle(self, node, prev_id, scope):
        # Check if the previous node can be consolidated AND current node can be consolidated
        if self._should_consolidate_with_previous(prev_id, scope):
            return self._consolidate_with_previous(node, prev_id, scope)

        augassign_id = self.processor._generate_id("augassign")
        # Get the operator symbol
        op_symbol = self.processor._get_operator_symbol(node.op)
        # Format: "count += 1" or "x *= 2"
        text = f"{self.processor._get_node_text(node.target)} {op_symbol} {self.processor._get_node_text(node.value)}"
        self.processor._add_node(augassign_id, text, scope=scope)
        self.processor._add_connection(prev_id, augassign_id)
        return augassign_id

class ImportHandler(NodeHandler):
    """Handle import statements like 'import os'"""
    
    def handle(self, node, prev_id, scope):
        # If we've already added an import, skip further imports
        if not self.processor.show_imports:
            return prev_id
        if self.processor._first_import_rendered:
            # Add "..." to the previous node to indicate more imports
            if prev_id in self.processor.nodes:
                current_text = self.processor.nodes[prev_id]
                if '...' not in current_text:
                    self.processor.nodes[prev_id] = current_text.replace('"\]', '\n..."\]')
            return prev_id
        names = [alias.name for alias in node.names]
        text = f"import {', '.join(names)}"
        import_id = self.processor._generate_id("import")
        self.processor._add_node(import_id, text, shape=FlowchartConfig.SHAPES['import'], scope=scope)
        self.processor._add_connection(prev_id, import_id)
        self.processor._first_import_rendered = True
        return import_id

class ImportFromHandler(NodeHandler):
    """Handle from imports like 'from os import path'"""
    
    def handle(self, node, prev_id, scope):
        # If we've already added an import, skip further imports
        if not self.processor.show_imports:
            return prev_id
        if self.processor._first_import_rendered:
            return prev_id
        module = node.module or ""
        names = [alias.name for alias in node.names]
        text = f"from {module} import {', '.join(names)}"
        importfrom_id = self.processor._generate_id("importfrom")
        self.processor._add_node(importfrom_id, text, shape=FlowchartConfig.SHAPES['import'], scope=scope)
        self.processor._add_connection(prev_id, importfrom_id)
        self.processor._first_import_rendered = True
        return importfrom_id

class ClassHandler(NodeHandler):
    """Handle class definitions with subgraph creation for classes and methods."""
    nodes_to_delete : list = []
    
    def handle(self, node, prev_id, scope):
        if not self.processor.show_classes:
            return prev_id
        
        # Store class info for method calls and context (always needed)
        self.processor.class_defs[node.name] = node
        
        # Extract class context data (docstring, methods, class variables)
        self._extract_class_context(node)
        
        # Store method definitions for future calls
        if not hasattr(self.processor, 'method_defs'):
            self.processor.method_defs = {}
        
        for item in node.body:
            if isinstance(item, ast.FunctionDef):
                method_key = f"{node.name}.{item.name}"
                self.processor.method_defs[method_key] = item
        
        # Only create visual class node if classes are shown
        if self.processor.show_classes:
            class_id = self.processor._generate_id("class")
            
            # Handle inheritance if present
            if node.bases:
                base_names = [self.processor._get_node_text(base) for base in node.bases]
                text = f"Class: {node.name}({', '.join(base_names)})"
            else:
                text = f"Class: {node.name}"
            
            # Add decorators if present
            if node.decorator_list:
                decorator_names = [self.processor._get_node_text(dec) for dec in node.decorator_list]
                text = f"{', '.join(decorator_names)}\n{text}"
            
            # Set the class scope for subgraph generation
            class_scope = f"class_{node.name}"
            self.processor._add_node(class_id, text, shape=FlowchartConfig.SHAPES['function_call'], scope=class_scope)
            ClassHandler.nodes_to_delete.append(class_id)
        
        # Return the previous ID since we don't connect to main flow
        return prev_id
    
    def _extract_class_context(self, class_node):
        """Extract class context data for method tracking."""
        docstring = ast.get_docstring(class_node) or ""
        methods = []
        class_variables = []
        
        for item in class_node.body:
            if isinstance(item, ast.FunctionDef):
                methods.append(item.name)
            elif isinstance(item, ast.Assign):
                # Class-level variable assignments
                for target in item.targets:
                    if isinstance(target, ast.Name):
                        class_variables.append(target.id)
        
        # Store class context data
        self.processor.context_data[class_node.name] = {
            "docstring": docstring,
            "methods": sorted(methods),
            "class_variables": sorted(class_variables),
            "type": "class"
        }

    def _create_method_subgraph(self, class_name, method_name, method_node, call_node_id):
        """Create a subgraph for a method that is being called."""
        # Create method scope
        method_scope = f"class_{class_name}_{method_name}"
        
        # Create method node with arguments
        method_id = self.processor._generate_id(f"method_{method_name}")
        # Ensure node_line_map captures the method definition line
        self.processor.last_added_node = method_node
        args_text = self._get_method_arguments(method_node)
        if method_name == '__init__':
            text = f"Constructor: __init__({args_text})"
        else:
            text = f"Method: {method_name}({args_text})"
        self.processor._add_node(method_id, text, shape=FlowchartConfig.SHAPES['function_call'], scope=method_scope)
        
        # Connect the call to the method
        label = "Call __init__" if method_name == '__init__' else "Execute"
        self.processor._add_connection(call_node_id, method_id, label=label)
        
        # Store the calling node for this method scope so returns can connect back
        if not hasattr(self, 'method_calling_nodes'):
            self.method_calling_nodes = {}
        self.method_calling_nodes[method_scope] = call_node_id
        
        # Process method body and create subgraph content
        self._process_method_body(method_node, method_id, method_scope)

    def _process_method_body(self, method_node, method_id, method_scope):
        """Process method body and create nodes within the method scope."""
        if method_node.body:
            self.processor._process_node_list(method_node.body, method_id, method_scope)
    
    def _get_method_arguments(self, method_node):
        """Extract method arguments as a string."""
        args = []
        for arg in method_node.args.args:
            # Skip 'self' parameter
            if arg.arg == 'self':
                continue
            args.append(arg.arg)
        return ", ".join(args) if args else ""

class FunctionDefHandler(NodeHandler):
    """Handle function definitions - they should not appear as nodes in the flowchart."""
    
    def handle(self, node, prev_id, scope):
        # Function definitions are stored for function calls but don't create visual nodes
        # They are filtered out in _should_process_node, but this handler exists for clarity
        return prev_id

class UnsupportedHandler(NodeHandler):
    """Handle unsupported node types."""
    
    def handle(self, node, prev_id, scope):
        unsupported_id = self.processor._generate_id("unsupported")
        self.processor._add_node(unsupported_id, f"Unsupported Node: {type(node).__name__}", shape=FlowchartConfig.SHAPES['import'], scope=scope)
        self.processor._add_connection(prev_id, unsupported_id)
        return unsupported_id

class BreakHandler(NodeHandler):
    """Handle break statements."""
    
    def handle(self, node, prev_id, scope):
        if self.processor.loop_stack: 
            self.processor._add_connection(prev_id, self.processor.loop_stack[-1]['exit'])
        return None

class ContinueHandler(NodeHandler):
    """Handle continue statements."""
    
    def handle(self, node, prev_id, scope):
        if self.processor.loop_stack: 
            self.processor._add_connection(prev_id, self.processor.loop_stack[-1]['start'])
        return None

class TryHandler(NodeHandler):
    """Handle try-except blocks."""
    
    def handle(self, node, prev_id, scope):
        # Create try node
        try_id = self.processor._generate_id("try")
        self.processor._add_node(try_id, "Try", shape=FlowchartConfig.SHAPES['try'], scope=scope)
        self.processor._add_connection(prev_id, try_id)
        
        # Create merge node for after try-except
        merge_id = self.processor._generate_id("merge")
        self.processor._add_node(merge_id, " ", shape=FlowchartConfig.SHAPES['merge'])
        
        # Process try body
        try_end_id = self.processor._process_node_list(node.body, try_id, scope, next_node_label="Try")
        if try_end_id:
            self.processor._add_connection(try_end_id, merge_id)
        
        # Process except handlers
        if node.handlers:
            for handler in node.handlers:
                except_id = self.processor._generate_id("except")
                # Create except condition text
                if handler.type:
                    type_text = self.processor._get_node_text(handler.type)
                    if handler.name:
                        except_text = f"Except {type_text} as {handler.name}"
                    else:
                        except_text = f"Except {type_text}"
                else:
                    except_text = "Except" if not handler.name else f"Except as {handler.name}"
                
                self.processor._add_node(except_id, except_text, shape=FlowchartConfig.SHAPES['exception'], scope=scope)
                self.processor._add_connection(try_id, except_id, label="Exception")
                
                # Process except body
                except_end_id = self.processor._process_node_list(handler.body, except_id, scope)
                if except_end_id:
                    self.processor._add_connection(except_end_id, merge_id)
        
        # Process else clause (if no exception occurred)
        if node.orelse:
            else_id = self.processor._generate_id("else")
            self.processor._add_node(else_id, "Else", shape=FlowchartConfig.SHAPES['condition'], scope=scope)
            self.processor._add_connection(try_id, else_id, label="No Exception")
            
            # Process else body
            else_end_id = self.processor._process_node_list(node.orelse, else_id, scope)
            if else_end_id:
                self.processor._add_connection(else_end_id, merge_id)
        
        # Process finally clause
        if node.finalbody:
            finally_id = self.processor._generate_id("finally")
            self.processor._add_node(finally_id, "Finally", shape=FlowchartConfig.SHAPES['finally'], scope=scope)
            
            # Connect merge to finally (everything converges to finally)
            self.processor._add_connection(merge_id, finally_id)
            
            # Process finally body
            finally_end_id = self.processor._process_node_list(node.finalbody, finally_id, scope)
            if finally_end_id:
                self.processor._add_connection(finally_end_id, finally_id)
            
            # Return finally node as the exit point
            return finally_id
        
        return merge_id

class RaiseHandler(NodeHandler):
    """Handle raise statements."""
    
    def handle(self, node, prev_id, scope):
        raise_id = self.processor._generate_id("raise")
        
        # Create raise node with exception details
        if node.exc:
            exception_text = self.processor._get_node_text(node.exc)
            if node.cause:
                cause_text = self.processor._get_node_text(node.cause)
                text = f"Raise {exception_text} from {cause_text}"
            else:
                text = f"Raise {exception_text}"
        else:
            text = "Re-raise Exception"
        
        self.processor._add_node(raise_id, text, shape=FlowchartConfig.SHAPES['exception'], scope=scope)
        self.processor._add_connection(prev_id, raise_id)
        
        # Raise statements don't connect to anything - they just end the flow
        return None  # No further processing after raise

class WithHandler(NodeHandler):
    """Handle with statements (context managers)."""
    
    def handle(self, node, prev_id, scope):
        with_id = self.processor._generate_id("with")
        
        # Create with node with context manager details
        if node.items:
            contexts = []
            for item in node.items:
                if item.optional_vars:
                    context_text = f"{self.processor._get_node_text(item.context_expr)} as {self.processor._get_node_text(item.optional_vars)}"
                else:
                    context_text = self.processor._get_node_text(item.context_expr)
                contexts.append(context_text)
            
            text = f"With: {', '.join(contexts)}"
        else:
            text = "With Statement"
        
        self.processor._add_node(with_id, text, shape=FlowchartConfig.SHAPES['exception'], scope=scope)
        self.processor._add_connection(prev_id, with_id)
        
        # Process with body
        body_end_id = self.processor._process_node_list(node.body, with_id, scope)
        if body_end_id:
            return body_end_id
        
        return with_id

class AssertHandler(NodeHandler):
    """Handle assert statements."""
    
    def handle(self, node, prev_id, scope):
        assert_id = self.processor._generate_id("assert")
        
        # Create assert node with condition and message
        condition_text = self.processor._get_node_text(node.test)
        if node.msg:
            message_text = self.processor._get_node_text(node.msg)
            text = f"Assert: {condition_text}, {message_text}"
        else:
            text = f"Assert: {condition_text}"
        
        self.processor._add_node(assert_id, text, shape=FlowchartConfig.SHAPES['exception'], scope=scope)
        self.processor._add_connection(prev_id, assert_id)
        
        return assert_id

class PassHandler(NodeHandler):
    """Handle pass statements."""
    
    def handle(self, node, prev_id, scope):
        pass_id = self.processor._generate_id("pass")
        
        # Create pass node
        text = "Pass"
        self.processor._add_node(pass_id, text, shape=FlowchartConfig.SHAPES['print'], scope=scope)
        self.processor._add_connection(prev_id, pass_id)
        
        return pass_id

class LambdaHandler(NodeHandler):
    """Handle lambda expressions."""
    
    def handle(self, node, prev_id, scope):
        lambda_id = self.processor._generate_id("lambda")
        
        # Handle both direct Lambda nodes and Expr-wrapped Lambda nodes
        if isinstance(node, ast.Lambda):
            lambda_node = node
        elif isinstance(node, ast.Expr) and isinstance(node.value, ast.Lambda):
            lambda_node = node.value
        else:
            # Fallback for unexpected node types
            text = "Lambda: <unknown>"
            self.processor._add_node(lambda_id, text, shape=FlowchartConfig.SHAPES['function_call'], scope=scope)
            self.processor._add_connection(prev_id, lambda_id)
            return lambda_id
        
        # Create lambda node with arguments and body
        args_text = ", ".join([arg.arg for arg in lambda_node.args.args]) if lambda_node.args.args else ""
        body_text = self.processor._get_node_text(lambda_node.body)
        text = f"Lambda: {args_text} → {body_text}"
        
        self.processor._add_node(lambda_id, text, shape=FlowchartConfig.SHAPES['function_call'], scope=scope)
        self.processor._add_connection(prev_id, lambda_id)
        
        return lambda_id

class ComprehensionHandler(NodeHandler):
    """Handle list/dict comprehensions."""
    
    def handle(self, node, prev_id, scope):
        comp_id = self.processor._generate_id("comprehension")
        
        # Handle both direct comprehension nodes and Expr-wrapped comprehension nodes
        if isinstance(node, (ast.ListComp, ast.DictComp, ast.SetComp, ast.GeneratorExp)):
            comp_node = node
        elif isinstance(node, ast.Expr) and isinstance(node.value, (ast.ListComp, ast.DictComp, ast.SetComp, ast.GeneratorExp)):
            comp_node = node.value
        else:
            # Fallback for unexpected node types
            text = "Comprehension: <unknown>"
            self.processor._add_node(comp_id, text, shape=FlowchartConfig.SHAPES['function_call'], scope=scope)
            self.processor._add_connection(prev_id, comp_id)
            return comp_id
        
        # Determine comprehension type and create text
        if isinstance(comp_node, ast.ListComp):
            comp_type = "List"
        elif isinstance(comp_node, ast.DictComp):
            comp_type = "Dict"
        elif isinstance(comp_node, ast.SetComp):
            comp_type = "Set"
        elif isinstance(comp_node, ast.GeneratorExp):
            comp_type = "Generator"
        else:
            comp_type = "Comprehension"
        
        # Extract key components
        if hasattr(comp_node, 'elt'):
            element_text = self.processor._get_node_text(comp_node.elt)
        elif hasattr(comp_node, 'key') and hasattr(comp_node, 'value'):
            element_text = f"{self.processor._get_node_text(comp_node.key)}: {self.processor._get_node_text(comp_node.value)}"
        else:
            element_text = "expression"
        
        # Extract generators/iterators
        generators = []
        for gen in comp_node.generators:
            target_text = self.processor._get_node_text(gen.target)
            iter_text = self.processor._get_node_text(gen.iter)
            if gen.ifs:
                if_text = " and ".join([self.processor._get_node_text(if_cond) for if_cond in gen.ifs])
                generators.append(f"{target_text} in {iter_text} if {if_text}")
            else:
                generators.append(f"{target_text} in {iter_text}")
        
        generators_text = " for " + " for ".join(generators)
        text = f"{comp_type}: {element_text}{generators_text}"
        
        self.processor._add_node(comp_id, text, shape=FlowchartConfig.SHAPES['function_call'], scope=scope)
        self.processor._add_connection(prev_id, comp_id)
        
        return comp_id

class ExitFunctionHandler(NodeHandler):
    """Handle functions that exit the current function/program."""
    
    def handle(self, node, prev_id, scope):
        exit_id = self.processor._generate_id("exit_function")
        text = f"Exit: {self.processor._get_node_text(node)}"
        self.processor._add_node(exit_id, text, shape=FlowchartConfig.SHAPES['exit'], scope=scope)
        self.processor._add_connection(prev_id, exit_id)
        return None

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
        self.class_defs = {} # Added for class definitions
        self.context_data = {}
        
        # Recursion tracking
        self.recursive_calls = {}  # Track recursive function calls
        self.function_start_nodes = {}  # Track function start nodes for recursion loops
        
        # Nesting depth tracking
        self.current_nesting_depth = 0  # Track current function call nesting depth
        
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
            'merge_common_nodes': 'MERGE_COMMON_NODES'
        }
        
        for attr, env_var in config_map.items():
            setattr(self, attr, os.environ.get(env_var, '1') == '1')

    def _register_handlers(self):
        """Register all node handlers using Strategy Pattern."""
        self.handlers = {
            ast.If: IfHandler(self),
            ast.For: ForHandler(self),
            ast.While: WhileHandler(self),
            ast.Expr: ExprHandler(self),
            ast.Return: ReturnHandler(self),
            ast.Assign: AssignHandler(self),
            ast.AugAssign: AugAssignHandler(self),
            ast.Import: ImportHandler(self),
            ast.ImportFrom: ImportFromHandler(self),
            ast.Break: BreakHandler(self),
            ast.Continue: ContinueHandler(self),
            ast.Try: TryHandler(self),
            ast.Raise: RaiseHandler(self),
            ast.With: WithHandler(self),
            ast.Assert: AssertHandler(self),
            ast.Pass: PassHandler(self),
            ast.Lambda: LambdaHandler(self),
            ast.ListComp: ComprehensionHandler(self),
            ast.DictComp: ComprehensionHandler(self),
            ast.SetComp: ComprehensionHandler(self),
            ast.GeneratorExp: ComprehensionHandler(self),
            ast.FunctionDef: FunctionDefHandler(self),
            ast.ClassDef: ClassHandler(self),
            'exit_function': ExitFunctionHandler(self),
            'print': PrintHandler(self)
        }
        self.default_handler = UnsupportedHandler(self)

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
        # Record the original source line for this node if available
        try:
            if hasattr(self, 'last_added_node') and self.last_added_node is not None:
                lineno = getattr(self.last_added_node, 'lineno', None)
                if not hasattr(self, 'node_line_map'):
                    self.node_line_map = {}
                if lineno is not None:
                    self.node_line_map[node_id] = {
                        'start_line': int(lineno),
                    }
        except Exception:
            # Best-effort only; do not break generation on mapping errors
            pass
        return True

    def _add_connection(self, from_id, to_id, label=""):
        """Add connection between nodes with fallback handling."""
        if from_id is None or to_id is None:
            return
        
        if not label and self.next_node_label:
            label = self.next_node_label
            self.next_node_label = None

        # Handle node object fallback for max nodes exceeded
        if hasattr(from_id, 'lineno') and self.nodes:
            from_id = list(self.nodes.keys())[-1]
        
        connection = f'    {from_id} -->|{label}| {to_id}' if label else f'    {from_id} --> {to_id}'
        self.connections.append(connection)

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
            handler : NodeHandler = self.handlers.get(type(node), self.default_handler)
            new_id = handler.handle(node, current_id, scope)

            # Reset next node label after the first node
            self.next_node_label = None

            if current_id == new_id:
                continue
            
            # Handle max nodes limit
            if new_id is False:
                self._handle_max_nodes_exceeded(current_id)
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
                    self.class_defs[node.name] = node

            # Process main flow
            current_id = self._process_main_flow(start_id, main_flow_nodes)
            
            # Connect to end if needed
            if current_id and current_id != start_id and current_id is not False:
                self._add_connection(current_id, self.end_id)

            # Delete nodes that are not connected to anything
            for node_id in ClassHandler.nodes_to_delete:
                del self.nodes[node_id]

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
