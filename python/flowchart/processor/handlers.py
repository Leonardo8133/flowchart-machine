import ast
import logging
from typing import Optional, List, Dict, Any, Union
from .config import FlowchartConfig

logger = logging.getLogger(__name__)

class NodeHandler:
    """Base class for node handlers using Strategy Pattern."""
    
    def __init__(self, processor):
        self.processor = processor
    
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
        if any(keyword in prev_node_def for keyword in ['if', 'for', 'while', 'Call:', 'return']):
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
        text = f"if {condition_text}"
        cond_id = self.processor._generate_id("if_cond")
        self.processor._add_node(cond_id, text, shape=FlowchartConfig.SHAPES['condition'], scope=scope)
        self.processor._add_connection(prev_id, cond_id)
        
        # Process true path with "True" label
        true_path_end = self.processor._process_node_list(node.body, cond_id, scope, next_node_label="True")
        
        # Process false path (else clause)
        if node.orelse:
            # We have an else clause, so we need a merge node
            merge_id = self.processor._generate_id("merge")
            self.processor._add_node(merge_id, " ", shape=FlowchartConfig.SHAPES['merge'])
            
            if true_path_end:
                self.processor._add_connection(true_path_end, merge_id)
            
            false_path_end = self.processor._process_node_list(node.orelse, cond_id, scope, next_node_label="False")
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
                # Simple if statement in method context - need to handle false path
                # Check if true_path_end is actually a valid node or just the starting cond_id
                
                if true_path_end and true_path_end != cond_id:
                    # True path has actual content - create merge for both paths
                    merge_id = self.processor._generate_id("merge")
                    self.processor._add_node(merge_id, " ", shape=FlowchartConfig.SHAPES['merge'])
                    
                    # Connect true path end to merge
                    self.processor._add_connection(true_path_end, merge_id)
                    
                    # Connect false path to merge
                    self.processor._add_connection(cond_id, merge_id, label="False")
                    
                    return merge_id
                elif true_path_end and true_path_end == cond_id:
                    # True path ended immediately (e.g., with raise), but we still need to continue
                    # Only create the False path connection
                    merge_id = self.processor._generate_id("merge")
                    self.processor._add_node(merge_id, " ", shape=FlowchartConfig.SHAPES['merge'])
                    
                    # Connect false path to merge
                    self.processor._add_connection(cond_id, merge_id, label="False")
                    
                    return merge_id
                else:
                    # No true path content at all - just continue to next node
                    return cond_id
    
    def _add_label_to_connection(self, from_id, to_id, label):
        """Add a label to an existing connection."""
        # Find the connection in the connections list and add the label
        for i, connection in enumerate(self.processor.connections):
            if connection[0] == from_id and connection[1] == to_id:
                # Update the connection with the label
                self.processor.connections[i] = (from_id, to_id, label)
                break

class ForHandler(NodeHandler):
    """Handle for loops."""
    
    def handle(self, node, prev_id, scope):
        text = f"for {self.processor._get_node_text(node.target)} in {self.processor._get_node_text(node.iter)}"
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
        self.processor._add_node(loop_cond_id, f"while {self.processor._get_node_text(node.test)}", shape=FlowchartConfig.SHAPES['condition'], scope=scope)
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
            
            # Check for attribute calls like sys.exit() or method calls like obj.method() or self.attr.method()
            if hasattr(call.func, 'attr'):
                attr_name = call.func.attr
                if hasattr(call.func, 'value'):
                    # Check if it's a simple name (obj.method or sys.exit)
                    if hasattr(call.func.value, 'id'):
                        module_name = call.func.value.id
                        full_name = f"{module_name}.{attr_name}"
                        if full_name in FlowchartConfig.EXIT_FUNCTIONS:
                            return self.processor.handlers['exit_function'].handle(node, prev_id, scope)
                    
                    # Check if calling a method on a class directly (like TestClass.method())
                    # Extract the class name to pass to _handle_method_call
                    class_name_for_call = None
                    if hasattr(call.func.value, 'id') and call.func.value.id in self.processor.class_defs:
                        class_name_for_call = call.func.value.id
                    
                    # Handle any method call with attribute access (obj.method, self.attr.method, etc.)
                    return self._handle_method_call(node, prev_id, scope, attr_name, class_name_for_call)
            
            # Check for direct function names
            if func_name in FlowchartConfig.EXIT_FUNCTIONS:
                return self.processor.handlers['exit_function'].handle(node, prev_id, scope)

            # Handle print statements and other function calls
            if func_name == 'print':
                return self.processor.handlers['print'].handle(node, prev_id, scope)
            
            # Handle class instantiation (only if it's not a method call)
            if func_name and func_name in self.processor.class_defs and not hasattr(call.func, 'attr'):
                if not self.processor.show_classes:
                    return prev_id
                
                return self._handle_class_instantiation(node, prev_id, scope, func_name)
            
            # Handle static method calls like TestClass.method()
            if func_name and func_name in self.processor.class_defs and hasattr(call.func, 'attr'):
                attr_name = call.func.attr
                return self._handle_method_call(node, prev_id, scope, attr_name, func_name)
               
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
    
    def _handle_method_call(self, node, prev_id, scope, method_name, class_name=None):
        """Handle method calls on objects."""
        method_call_id = self.processor._generate_id("method_call")
        text = f"Call: {self.processor._get_node_text(node)}"
        self.processor._add_node(method_call_id, text, shape=FlowchartConfig.SHAPES['function_call'], scope=scope)
        self.processor._add_connection(prev_id, method_call_id)
        
        if not self.processor.show_classes:
            return method_call_id
        
        # Try to find the method definition and create a subgraph for it
        method_found = False
        
        if class_name and class_name in self.processor.class_defs:
            # We know the specific class, look for the method in that class
            class_info = self.processor.class_defs[class_name]
            if method_name in class_info["methods"]:
                method_node = class_info["methods"][method_name]
                
                # Check if this is calling an instance method on a class without instantiation
                # If the method has 'self' as first parameter, we can't call it on the class directly
                # Exception: entry point analysis allows this for visualization purposes
                entry_type = getattr(self.processor, 'context', {}).get('entry_type')
                # entry_type is None for file mode, 'class' for class entry point analysis
                if entry_type != 'class' and method_node.args.args and len(method_node.args.args) > 0:
                    first_param = method_node.args.args[0].arg
                    if first_param == 'self':
                        # This is an instance method being called on a class - show error (only in file mode)
                        error_id = self.processor._generate_id("error")
                        error_text = f"❌ Instance method '{method_name}' called on class '{class_name}' without instantiation"
                        self.processor._add_node(error_id, error_text, shape=FlowchartConfig.SHAPES['exception'], scope=scope)
                        self.processor._add_connection(method_call_id, error_id)
                        return error_id
                
                # Method is either static or we're calling it on an instance
                method_exit_id = self.processor.handlers[ast.ClassDef]._create_method_subgraph(class_name, method_name, method_node, method_call_id)
                method_found = True
                
                # In sequential flow, return the method exit so it can connect to the next statement
                if self.processor.sequential_flow and method_exit_id and method_exit_id != method_call_id:
                    return method_exit_id
        
        # Try to resolve the object type if not already resolved
        if not method_found and isinstance(node.value, ast.Call) and hasattr(node.value.func, 'value'):
            call_obj = node.value.func.value
            resolved_class = self.processor.handlers[ast.Assign]._resolve_object_type(call_obj, scope)
            
            # Special handling for 'self' calls within methods
            if resolved_class is None and isinstance(call_obj, ast.Name) and call_obj.id == 'self':
                # Extract class name from current scope (format: class_ClassName_methodName)
                if scope and scope.startswith("class_"):
                    parts = scope.split("_")
                    if len(parts) >= 2:
                        resolved_class = parts[1]
            
            if resolved_class and resolved_class in self.processor.class_defs:
                class_info = self.processor.class_defs[resolved_class]
                if method_name in class_info["methods"]:
                    method_node = class_info["methods"][method_name]
                    method_exit_id = self.processor.handlers[ast.ClassDef]._create_method_subgraph(resolved_class, method_name, method_node, method_call_id)
                    method_found = True
                    
                    # In sequential flow, return the method exit so it can connect to the next statement
                    if self.processor.sequential_flow and method_exit_id and method_exit_id != method_call_id:
                        return method_exit_id
        
        if not method_found:
            # Could not find the method or couldn't resolve the class
            error_id = self.processor._generate_id("error")
            if resolved_class:
                error_text = f"❌ Method '{method_name}' not found in {resolved_class}"
            else:
                error_text = f"❌ Could not resolve class for method '{method_name}'"
            self.processor._add_node(error_id, error_text, shape=FlowchartConfig.SHAPES['exception'], scope=scope)
            self.processor._add_connection(method_call_id, error_id)
            return error_id
        
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
            class_info = self.processor.class_defs[class_name]
            # Look for __init__ method in the class
            if '__init__' in class_info["methods"]:
                method_node = class_info["methods"]['__init__']
                # Create __init__ method subgraph and connect instantiation to it
                self.processor.handlers[ast.ClassDef]._create_method_subgraph(class_name, '__init__', method_node, instantiation_id)
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
        current_id = prev_id
        skip_return_creation = False
        
        # Check if return value contains a method call - process it first
        if node.value and isinstance(node.value, ast.Call):
            func_name = getattr(node.value.func, 'id', None)
            
            # Check for recursive function call
            if func_name and self.processor._is_recursive_call(func_name, scope):
                # Create return node first
                return_id = self.processor._generate_id("return")
                text = self.processor._get_node_text(node)
                self.processor._add_node(return_id, text, scope=scope)
                self.processor._add_connection(current_id, return_id)
                
                # This is a recursive return - create loop back to function start
                function_start = self.processor._get_function_start_node(scope)
                if function_start:
                    self.processor._add_connection(return_id, function_start, label="Recursion")
                    # Store this as a recursive call for later processing
                    if scope not in self.processor.recursive_calls:
                        self.processor.recursive_calls[scope] = []
                    self.processor.recursive_calls[scope].append(return_id)
                return None
            
            # Check if it's a method call (has attribute access)
            if hasattr(node.value.func, 'attr'):
                attr_name = node.value.func.attr
                
                # Create return node first (not a separate call node)
                return_id = self.processor._generate_id("return")
                text = self.processor._get_node_text(node) if node.value else "return"
                self.processor._add_node(return_id, text, scope=scope)
                self.processor._add_connection(current_id, return_id)
                
                # Try to resolve and create subgraph directly from return node
                if hasattr(node.value.func, 'value'):
                    call_obj = node.value.func.value
                    resolved_class = self.processor.handlers[ast.Assign]._resolve_object_type(call_obj, scope)
                    
                    # Special handling for 'self' calls within methods
                    if resolved_class is None and isinstance(call_obj, ast.Name) and call_obj.id == 'self':
                        # Extract class name from current scope (format: class_ClassName_methodName)
                        if scope and scope.startswith("class_"):
                            parts = scope.split("_")
                            if len(parts) >= 2:
                                resolved_class = parts[1]
                    
                    if resolved_class and resolved_class in self.processor.class_defs:
                        class_info = self.processor.class_defs[resolved_class]
                        if attr_name in class_info["methods"]:
                            method_node = class_info["methods"][attr_name]
                            # Connect return node directly to the method
                            self.processor.handlers[ast.ClassDef]._create_method_subgraph(resolved_class, attr_name, method_node, return_id)
                
                current_id = return_id
                skip_return_creation = True
            else:
                skip_return_creation = False
        
        # Create return node (if not already created above)
        if not skip_return_creation:
            return_id = self.processor._generate_id("return")
            text = self.processor._get_node_text(node) if node.value else "return"
            self.processor._add_node(return_id, text, scope=scope)
            self.processor._add_connection(current_id, return_id)
        
        # Check if we're in a method scope (class_methodName)
        if scope and scope.startswith("class_") and "_" in scope[6:]:
            # We're in a method
            if self.processor.sequential_flow:
                # Track this return as the method's exit point
                if scope not in self.processor.method_exit_nodes:
                    self.processor.method_exit_nodes[scope] = []
                self.processor.method_exit_nodes[scope].append(return_id)
            # No need to connect back - bidirectional arrows or sequential flow handles it
            pass
        elif self.processor.call_stack:
            # We're in a function call, connect back to the call stack
            self.processor._add_connection(return_id, self.processor.call_stack[-1])
        else:
            # We're in the main flow, connect to end
            self.processor._add_connection(return_id, self.processor.end_id)
        
        return return_id

class AssignHandler(NodeHandler):
    """Handle assignments including function call assignments and class instantiation."""
    
    def handle(self, node, prev_id, scope):
        # Track attribute assignments like self.db = db
        if len(node.targets) == 1 and isinstance(node.targets[0], ast.Attribute):
            target_attr = node.targets[0]
            # Check if it's self.attribute
            if isinstance(target_attr.value, ast.Name) and target_attr.value.id == 'self':
                attr_name = target_attr.attr
                # Check if the value is a parameter with known type
                if isinstance(node.value, ast.Name):
                    param_name = node.value.id
                    # Look up parameter type in current scope
                    if scope in self.processor.parameter_types and param_name in self.processor.parameter_types[scope]:
                        param_type = self.processor.parameter_types[scope][param_name]
                        # Track attribute type
                        if scope not in self.processor.attribute_types:
                            self.processor.attribute_types[scope] = {}
                        self.processor.attribute_types[scope][attr_name] = param_type
                # Also track when right-hand side is a class instantiation: self.attr = SomeClass(...)
                elif isinstance(node.value, ast.Call) and hasattr(node.value.func, 'id'):
                    class_name = node.value.func.id
                    if class_name in self.processor.class_defs:
                        # Track attribute type
                        if scope not in self.processor.attribute_types:
                            self.processor.attribute_types[scope] = {}
                        self.processor.attribute_types[scope][attr_name] = class_name
        
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
            if hasattr(call.func, 'attr'):
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
        
        # Special handling for __init__ calls
        if method_name == '__init__':
            # Check if this is a redundant __init__ call (e.g., TestClass().__init__())
            if isinstance(node.value, ast.Call) and hasattr(node.value.func, 'value'):
                call_obj = node.value.func.value
                
                # Check if the call_obj is itself a class instantiation (e.g., TestClass())
                if isinstance(call_obj, ast.Call) and hasattr(call_obj.func, 'id'):
                    class_name = call_obj.func.id
                    if class_name in self.processor.class_defs:
                        # First, process the class instantiation (TestClass())
                        # This will call the constructor
                        class_info = self.processor.class_defs[class_name]
                        if '__init__' in class_info["methods"]:
                            init_node = class_info["methods"]['__init__']
                            last_node_id = self.processor.handlers[ast.ClassDef]._create_method_subgraph(
                                class_name, '__init__', init_node, assign_id
                            )
                        
                        # Then show warning about the redundant __init__() call
                        warning_id = self.processor._generate_id("warning")
                        warning_text = f"⚠️ Redundant __init__ call: {class_name}() already calls constructor"
                        self.processor._add_node(warning_id, warning_text, shape=FlowchartConfig.SHAPES['exception'], scope=scope)
                        self.processor._add_connection(assign_id, warning_id)
                        return warning_id
        
        # Try to find the method definition and create a subgraph for it
        method_found = False
        
        # Try to determine the class from the call
        if isinstance(node.value, ast.Call) and hasattr(node.value.func, 'value'):
            call_obj = node.value.func.value
            resolved_class = self._resolve_object_type(call_obj, scope)
            
            # Special handling for 'self' calls within methods
            if resolved_class is None and isinstance(call_obj, ast.Name) and call_obj.id == 'self':
                # Extract class name from current scope (format: class_ClassName_methodName)
                if scope and scope.startswith("class_"):
                    parts = scope.split("_")
                    if len(parts) >= 2:
                        resolved_class = parts[1]
            
            if resolved_class and resolved_class in self.processor.class_defs:
                class_info = self.processor.class_defs[resolved_class]
                if method_name in class_info["methods"]:
                    method_node = class_info["methods"][method_name]
                    
                    # Check if this is calling an instance method on a class without instantiation
                    # If call_obj is a class name (not an instance), we need to check
                    if isinstance(call_obj, ast.Name) and call_obj.id in self.processor.class_defs:
                        # This is a direct class call like TestClass2.calculate_value()
                        # Check if method has 'self' parameter
                        if method_node.args.args and len(method_node.args.args) > 0:
                            first_param = method_node.args.args[0].arg
                            if first_param == 'self':
                                # This is an instance method being called on the class - show error
                                error_id = self.processor._generate_id("error")
                                error_text = f"❌ Instance method '{method_name}' called on class '{resolved_class}' without instantiation"
                                self.processor._add_node(error_id, error_text, shape=FlowchartConfig.SHAPES['exception'], scope=scope)
                                self.processor._add_connection(assign_id, error_id)
                                return error_id
                    
                    method_exit_id = self.processor.handlers[ast.ClassDef]._create_method_subgraph(resolved_class, method_name, method_node, assign_id)
                    method_found = True
                    
                    # In sequential flow, connect method exit to the assignment, then continue to next
                    if self.processor.sequential_flow and method_exit_id and method_exit_id != assign_id:
                        # The method exit should connect to the assignment node
                        self.processor._add_connection(method_exit_id, assign_id)
        
        if not method_found:
            # Could not find the method or couldn't resolve the class
            error_id = self.processor._generate_id("error")
            if resolved_class:
                error_text = f"❌ Method '{method_name}' not found in {resolved_class}"
            else:
                error_text = f"❌ Could not resolve class for method '{method_name}'"
            self.processor._add_node(error_id, error_text, shape=FlowchartConfig.SHAPES['exception'], scope=scope)
            self.processor._add_connection(assign_id, error_id)
            return error_id
        
        return assign_id
    
    def _resolve_object_type(self, obj_node, scope):
        """Resolve the type of an object (variable, attribute access, etc.)."""
        # Simple variable: obj.method()
        if isinstance(obj_node, ast.Name):
            var_name = obj_node.id
            if var_name in self.processor.variable_types:
                return self.processor.variable_types[var_name]
            
            # Check if it's a direct class name (for static method calls like Calculator.add())
            if var_name in self.processor.class_defs:
                return var_name
        
        # Class instantiation: TestClass().method()
        if isinstance(obj_node, ast.Call):
            if hasattr(obj_node.func, 'id'):
                class_name = obj_node.func.id
                if class_name in self.processor.class_defs:
                    return class_name
        
        # Attribute access: self.attr.method() or obj.attr.method()
        if isinstance(obj_node, ast.Attribute):
            # Check if it's self.attribute
            if isinstance(obj_node.value, ast.Name) and obj_node.value.id == 'self':
                attr_name = obj_node.attr
                
                # Try current scope first
                if scope in self.processor.attribute_types and attr_name in self.processor.attribute_types[scope]:
                    return self.processor.attribute_types[scope][attr_name]
                
                # If not found, look up in class scope (attributes can be set in __init__ or other methods)
                # Scope format: class_ClassName_methodName -> search all methods in class_ClassName
                if scope and scope.startswith("class_"):
                    parts = scope.split("_")
                    if len(parts) >= 3:  # class_ClassName_methodName
                        class_name = parts[1]
                        # First try __init__ scope
                        init_scope = f"class_{class_name}___init__"
                        if init_scope in self.processor.attribute_types and attr_name in self.processor.attribute_types[init_scope]:
                            return self.processor.attribute_types[init_scope][attr_name]
                        # Then search all other methods in the class
                        for method_scope in self.processor.attribute_types:
                            if method_scope.startswith(f"class_{class_name}_") and attr_name in self.processor.attribute_types[method_scope]:
                                return self.processor.attribute_types[method_scope][attr_name]
            # Otherwise, recursively resolve the object type
            else:
                # For obj.attr, we'd need to track object attribute types
                # For now, skip this case
                pass
        
        return None
    
    def _handle_class_instantiation_assignment(self, node, prev_id, scope, class_name):
        """Handle class instantiation assignment by connecting to the class's __init__ method."""
        # Create assignment node
        assign_id = self.processor._generate_id("assign")
        self.processor._add_node(assign_id, self.processor._get_node_text(node), scope=scope)
        self.processor._add_connection(prev_id, assign_id)
        
        # Track variable type for method resolution
        if len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
            var_name = node.targets[0].id
            self.processor.variable_types[var_name] = class_name
        
        # Track parameter types passed to __init__
        if class_name in self.processor.class_defs and isinstance(node.value, ast.Call):
            class_info = self.processor.class_defs[class_name]
            if '__init__' in class_info["methods"]:
                method_node = class_info["methods"]['__init__']
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
                        # Check if argument is an attribute (like self.design)
                        elif isinstance(arg, ast.Attribute):
                            arg_type = self.processor.handlers[ast.Assign]._resolve_object_type(arg, scope)
                            if arg_type:
                                self.processor.parameter_types[method_scope][param_name] = arg_type
        
        # Find the class and connect to its __init__ method
        if class_name in self.processor.class_defs:
            class_info = self.processor.class_defs[class_name]
            
            # Look for __init__ method in the class
            if '__init__' in class_info["methods"]:
                method_node = class_info["methods"]['__init__']
                # Create __init__ method subgraph and connect assignment to it
                self.processor.handlers[ast.ClassDef]._create_method_subgraph(class_name, '__init__', method_node, assign_id)
        
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
    
    def handle(self, node, prev_id, scope):
        if not self.processor.show_classes:
            return prev_id
        
        # Store class info for method calls and context (always needed)
        # Only store if not already populated by main processor
        if node.name not in self.processor.class_defs:
            self.processor.class_defs[node.name] = {"node": node, "methods": {}}
        
        # Extract class context data (docstring, methods, class variables)
        self._extract_class_context(node)
        
        # Store method definitions for future calls
        if not hasattr(self.processor, 'method_defs'):
            self.processor.method_defs = {}
        
        for item in node.body:
            if isinstance(item, ast.FunctionDef):
                method_key = f"{node.name}.{item.name}"
                self.processor.method_defs[method_key] = item
        
        # Don't create a visual class node - the subgraph title serves this purpose
        # Just set the class scope for subgraph generation
        if self.processor.show_classes:
            class_scope = f"class_{node.name}"
            # Create a dummy node to ensure the scope is tracked for subgraph generation
            # but don't display it (empty text)
            dummy_id = self.processor._generate_id("class_dummy")
            self.processor._add_node(dummy_id, " ", scope=class_scope)  # Use space instead of empty string
        
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
        
        # Check if this method subgraph already exists
        if not hasattr(self.processor, 'method_subgraphs'):
            self.processor.method_subgraphs = {}
        
        method_key = f"{class_name}.{method_name}"
        if method_key in self.processor.method_subgraphs:
            # Method subgraph already exists, reuse it
            existing_method_id = self.processor.method_subgraphs[method_key]
            
            # Connect the call to the existing method
            if self.processor.sequential_flow:
                # Sequential mode: one-way arrow with label "Call"
                self.processor._add_connection(call_node_id, existing_method_id, label="Call", bidirectional=False)
            else:
                # Traditional mode: bidirectional arrow with label "Call and Return"
                label = "Call and Return"
                self.processor._add_connection(call_node_id, existing_method_id, label=label, bidirectional=True)
                
                # Store the calling node for this method scope so returns can connect back
                if not hasattr(self.processor, 'method_calling_nodes'):
                    self.processor.method_calling_nodes = {}
                self.processor.method_calling_nodes[method_scope] = call_node_id
            
            # Get the last node of the existing method
            if hasattr(self.processor, 'method_last_nodes') and existing_method_id in self.processor.method_last_nodes:
                last_node_id = self.processor.method_last_nodes[existing_method_id]
            else:
                last_node_id = existing_method_id
            
            # Store the last node of the method for potential end connection
            if not hasattr(self.processor, 'method_last_nodes'):
                self.processor.method_last_nodes = {}
            self.processor.method_last_nodes[call_node_id] = last_node_id
            
            # In sequential flow mode, if method has exit nodes (returns), use the last one
            if self.processor.sequential_flow and method_scope in self.processor.method_exit_nodes:
                exit_nodes = self.processor.method_exit_nodes[method_scope]
                if exit_nodes:
                    return exit_nodes[-1]
            
            return last_node_id
        
        # Method subgraph doesn't exist, create it
        method_id = self.processor._generate_id(f"method_{method_name}")
        self.processor.last_added_node = method_node
        args_text = self._get_method_arguments(method_node)
        if method_name == '__init__':
            text = f"Constructor: __init__({args_text})"
        else:
            text = f"Method: {method_name}({args_text})"
        self.processor._add_node(method_id, text, shape=FlowchartConfig.SHAPES['function_call'], scope=method_scope)
        
        # Store the method subgraph for future reuse
        self.processor.method_subgraphs[method_key] = method_id
        
        # Connect the call to the method
        if self.processor.sequential_flow:
            # Sequential mode: one-way arrow with label "Call"
            self.processor._add_connection(call_node_id, method_id, label="Call", bidirectional=False)
        else:
            # Traditional mode: bidirectional arrow with label "Call and Return"
            label = "Call and Return"
            self.processor._add_connection(call_node_id, method_id, label=label, bidirectional=True)
        
        # Store the calling node for this method scope so returns can connect back
        if not hasattr(self.processor, 'method_calling_nodes'):
            self.processor.method_calling_nodes = {}
        self.processor.method_calling_nodes[method_scope] = call_node_id
        
        # Process method body and create subgraph content
        last_node_id = self._process_method_body(method_node, method_id, method_scope)
        
        # Store the last node of the method for potential end connection
        if not hasattr(self.processor, 'method_last_nodes'):
            self.processor.method_last_nodes = {}
        self.processor.method_last_nodes[call_node_id] = last_node_id if last_node_id else method_id
        
        # In sequential flow mode, if method has exit nodes (returns), use the first one
        if self.processor.sequential_flow and method_scope in self.processor.method_exit_nodes:
            exit_nodes = self.processor.method_exit_nodes[method_scope]
            if exit_nodes:
                # Return the last exit node to connect it to the next statement after the call
                return exit_nodes[-1]
        
        return last_node_id

    def _process_method_body(self, method_node, method_id, method_scope):
        """Process method body and create nodes within the method scope."""
        if method_node.body:
            return self.processor._process_node_list(method_node.body, method_id, method_scope)
        return method_id
    
    def _get_method_arguments(self, method_node):
        """Extract method arguments as a string."""
        args = []
        for arg in method_node.args.args:
            # Skip 'self' parameter
            if arg.arg == 'self':
                continue
            args.append(arg.arg)
        return ", ".join(args) if args else ""

class MethodHandler(NodeHandler):
    """Handle method calls on objects with proper validation."""
    
    def handle_method_call(self, node, prev_id, scope, method_name, class_name=None, call_obj=None):
        """
        Handle a method call with validation.
        
        Args:
            node: AST node
            prev_id: Previous node ID
            scope: Current scope
            method_name: Name of the method being called
            class_name: Name of the class (if known from static call)
            call_obj: AST node of the object being called on (for resolution)
        """
        method_call_id = self.processor._generate_id("method_call")
        text = f"Call: {self.processor._get_node_text(node)}"
        self.processor._add_node(method_call_id, text, shape=FlowchartConfig.SHAPES['function_call'], scope=scope)
        self.processor._add_connection(prev_id, method_call_id)
        
        if not self.processor.show_classes:
            return method_call_id
        
        # Try to resolve the class if not already known
        if not class_name and call_obj:
            class_name = self.processor.handlers[ast.Assign]._resolve_object_type(call_obj, scope)
            
            # Special handling for 'self' calls within methods
            if class_name is None and isinstance(call_obj, ast.Name) and call_obj.id == 'self':
                # Extract class name from current scope (format: class_ClassName_methodName)
                if scope and scope.startswith("class_"):
                    parts = scope.split("_")
                    if len(parts) >= 2:
                        class_name = parts[1]
        
        # Try to find and validate the method
        method_found = False
        
        if class_name and class_name in self.processor.class_defs:
            class_info = self.processor.class_defs[class_name]
            
            # Check if method exists in the class
            if method_name in class_info["methods"]:
                method_node = class_info["methods"][method_name]
                self.processor.handlers[ast.ClassDef]._create_method_subgraph(class_name, method_name, method_node, method_call_id)
                method_found = True
            else:
                # Method not found in the class - check if it's actually a property
                is_property = self._is_class_property(class_name, method_name)
                if is_property:
                    # Warn: trying to call a property as a method
                    warning_id = self.processor._generate_id("warning")
                    warning_text = f"⚠️ '{method_name}' is a property, not a method"
                    self.processor._add_node(warning_id, warning_text, shape=FlowchartConfig.SHAPES['exception'], scope=scope)
                    self.processor._add_connection(method_call_id, warning_id)
                    return warning_id
                else:
                    # Method doesn't exist at all
                    error_id = self.processor._generate_id("error")
                    error_text = f"❌ Method '{method_name}' not found in {class_name}"
                    self.processor._add_node(error_id, error_text, shape=FlowchartConfig.SHAPES['exception'], scope=scope)
                    self.processor._add_connection(method_call_id, error_id)
                    return error_id
        if not method_found:
            # Could not find the method or couldn't resolve the class
            error_id = self.processor._generate_id("error")
            if class_name:
                error_text = f"❌ Method '{method_name}' not found in {class_name}"
            else:
                error_text = f"❌ Could not resolve class for method '{method_name}'"
            self.processor._add_node(error_id, error_text, shape=FlowchartConfig.SHAPES['exception'], scope=scope)
            self.processor._add_connection(method_call_id, error_id)
            return error_id
        
        return method_call_id
    
    def _is_class_property(self, class_name, property_name):
        """Check if a name is a property (attribute) of a class."""
        if class_name not in self.processor.class_defs:
            return False
        
        class_node = self.processor.class_defs[class_name]["node"]
        
        # Check __init__ for attribute assignments
        for item in class_node.body:
            if isinstance(item, ast.FunctionDef) and item.name == '__init__':
                for stmt in ast.walk(item):
                    if isinstance(stmt, ast.Assign):
                        for target in stmt.targets:
                            if isinstance(target, ast.Attribute) and target.attr == property_name:
                                return True
        
        # Check class-level attributes
        for item in class_node.body:
            if isinstance(item, ast.Assign):
                for target in item.targets:
                    if isinstance(target, ast.Name) and target.id == property_name:
                        return True
        
        return False
    
    def handle(self, node, prev_id, scope):
        # This handler is not called directly, it's used by other handlers
        return prev_id


class PropertyHandler(NodeHandler):
    """Handle property access on objects with validation."""
    
    def handle_property_access(self, node, prev_id, scope, property_name, class_name=None, obj_node=None):
        """
        Handle property access with validation.
        
        Args:
            node: AST node (the Attribute node)
            prev_id: Previous node ID
            scope: Current scope
            property_name: Name of the property being accessed
            class_name: Name of the class (if known)
            obj_node: AST node of the object (for resolution)
        """
        # Try to resolve the class if not already known
        if not class_name and obj_node:
            class_name = self.processor.handlers[ast.Assign]._resolve_object_type(obj_node, scope)
        
        # Validate the property exists
        if class_name and class_name in self.processor.class_defs:
            class_info = self.processor.class_defs[class_name]
            
            # Check if it's actually a method, not a property
            if property_name in class_info["methods"]:
                # Warn: accessing a method as a property
                warning_id = self.processor._generate_id("warning")
                warning_text = f"⚠️ '{property_name}' is a method, not a property. Did you forget ()?"
                self.processor._add_node(warning_id, warning_text, shape=FlowchartConfig.SHAPES['exception'], scope=scope)
                self.processor._add_connection(prev_id, warning_id)
                return warning_id
            
            # Check if property exists
            is_property = self._property_exists(class_name, property_name)
            if not is_property:
                # Property not found
                error_id = self.processor._generate_id("error")
                error_text = f"❌ Property '{property_name}' not found in {class_name}"
                self.processor._add_node(error_id, error_text, shape=FlowchartConfig.SHAPES['exception'], scope=scope)
                self.processor._add_connection(prev_id, error_id)
                return error_id
        
        # Property access is valid or we couldn't determine the class
        # Just return prev_id as property access doesn't create a node by itself
        return prev_id
    
    def _property_exists(self, class_name, property_name):
        """Check if a property exists in a class."""
        if class_name not in self.processor.class_defs:
            return False
        
        class_node = self.processor.class_defs[class_name]["node"]
        
        # Check __init__ for attribute assignments (self.property = ...)
        for item in class_node.body:
            if isinstance(item, ast.FunctionDef) and item.name == '__init__':
                for stmt in ast.walk(item):
                    if isinstance(stmt, ast.Assign):
                        for target in stmt.targets:
                            if isinstance(target, ast.Attribute) and target.attr == property_name:
                                return True
        
        # Check class-level attributes
        for item in class_node.body:
            if isinstance(item, ast.Assign):
                for target in item.targets:
                    if isinstance(target, ast.Name) and target.id == property_name:
                        return True
        
        return False
    
    def handle(self, node, prev_id, scope):
        # This handler is not called directly, it's used by other handlers
        return prev_id


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
