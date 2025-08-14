import ast
import sys
import os
import html
import re
import json

class FlowchartGenerator:
    """
    Generates a Mermaid JS flowchart with interactive tooltips for context.
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

    def _generate_id(self, prefix="node"):
        self.node_counter += 1
        return f"{prefix}{self.node_counter}"

    def _add_node(self, node_id, text, shape=('["', '"]'), scope=None):
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

    def _build_subgraphs(self):
        """Create nested Mermaid subgraph sections based on call hierarchy."""
        lines = []

        def build(scope, indent):
            lines.append("    " * indent + f"subgraph {scope}")
            for nid, sc in self.node_scopes.items():
                if sc == scope:
                    lines.append("    " * (indent + 1) + nid)
            for child in sorted(self.scope_children.get(scope, [])):
                build(child, indent + 1)
            lines.append("    " * indent + "end")

        for root_scope in sorted(self.scope_children.get(None, [])):
            build(root_scope, 1)

        return lines

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
            return text.replace("'", '"')
        return text
    
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

            handler_name = f"_handle_{type(node).__name__.lower()}"
            handler = getattr(self, handler_name, self._handle_unsupported)
            current_id = handler(node, current_id, scope)
        return current_id

    def _optimize_graph(self):
        # This function remains the same as the previous version
        bypass_nodes = {nid for nid, ndef in self.nodes.items() if re.search(r'\{\{\s*\}\}$', ndef)}
        if not bypass_nodes: return
        forwarding_map = {}
        conn_pattern = re.compile(r'\s*(\w+)\s*-->(?:\|(.*?)\|)?\s*(\w+)\s*')
        for conn_str in self.connections:
            match = conn_pattern.match(conn_str)
            if not match: continue
            from_id, _, to_id = match.groups()
            if from_id in bypass_nodes: forwarding_map[from_id] = to_id
        for node_id in list(forwarding_map.keys()):
            visited = {node_id}; current_target = forwarding_map.get(node_id)
            while current_target in forwarding_map:
                next_node = forwarding_map[current_target]
                if next_node in visited: break
                visited.add(next_node); current_target = next_node
            if current_target:
                for visited_node in visited: forwarding_map[visited_node] = current_target
        new_connections = []
        for conn_str in self.connections:
            match = conn_pattern.match(conn_str)
            if not match: continue
            from_id, label, to_id = match.groups()
            if from_id in bypass_nodes: continue
            if to_id in forwarding_map: to_id = forwarding_map[to_id]
            if label: new_connections.append(f'    {from_id} -->|{label}| {to_id}')
            else: new_connections.append(f'    {from_id} --> {to_id}')
        self.connections = new_connections
        for node_id in bypass_nodes:
            if node_id in self.nodes: del self.nodes[node_id]

    def clean_mermaid_diagram(self, mermaid_string):
        """Clean and fix Mermaid diagram syntax to prevent parsing errors."""
        cleaned = mermaid_string
        
        # Remove HTML entities and problematic characters
        cleaned = cleaned.replace('&lt;', '<')
        cleaned = cleaned.replace('&gt;', '>')
        cleaned = cleaned.replace('&amp;', '&')
        
        return cleaned

    def generate(self, python_code):
        try:
            tree = ast.parse(python_code)
            self.__init__()
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

            last_node_id = self._process_node_list(main_flow_nodes, start_id, scope=None)

            if last_node_id: self._add_connection(last_node_id, self.end_id)
            self._optimize_graph()

            mermaid_string = "graph TD\n"
            mermaid_string += "    " + "\n    ".join(self.nodes.values()) + "\n"
            mermaid_string += "\n".join(self._build_subgraphs()) + "\n"
            mermaid_string += "\n".join(self.connections) + "\n"
            mermaid_string += "\n".join(self.click_handlers) + "\n"
            
            # Clean the Mermaid diagram before returning
            cleaned_mermaid = self.clean_mermaid_diagram(mermaid_string)
            
            return cleaned_mermaid, self.tooltip_data

        except Exception as e:
            # Error handling remains the same
            error_message = f"Error parsing code: {e.__class__.__name__} - {e}"
            return f"graph TD\n    error[\"{error_message}\"]", {}


    # --- Node Handlers (Updated with 'scope' parameter) ---

    def _handle_if(self, node, prev_id, scope):
        # FIX: Add "If:" prefix
        text = f"If: {self._get_node_text(node.test)}"
        cond_id = self._generate_id("if_cond")
        self._add_node(cond_id, text, shape=('{"', '"}'), scope=scope)
        self._add_connection(prev_id, cond_id)
        
        merge_id = self._generate_id("merge")
        self._add_node(merge_id, " ", shape=('{{', '}}')) # No scope for merge nodes

        true_path_end = self._process_node_list(node.body, cond_id, scope)
        # ... (rest of the if logic is the same, just simplified for brevity)
        if node.body:
            for i, conn in reversed(list(enumerate(self.connections))):
                if conn.strip().startswith(f"{cond_id} -->") and '|' not in conn:
                    self.connections[i] = conn.replace("-->", "-->|True|")
                    break
        self._add_connection(true_path_end, merge_id)
        if node.orelse:
            false_path_end = self._process_node_list(node.orelse, cond_id, scope)
            if node.orelse:
                for i, conn in reversed(list(enumerate(self.connections))):
                    if conn.strip().startswith(f"{cond_id} -->") and '|' not in conn:
                        self.connections[i] = conn.replace("-->", "-->|False|")
                        break
            self._add_connection(false_path_end, merge_id)
        else:
            self._add_connection(cond_id, merge_id, label="False")
        return merge_id

    def _handle_for(self, node, prev_id, scope):
        # FIX: Use {{"..."}} shape for robustness
        text = f"For Loop: {self._get_node_text(node.target)} in {self._get_node_text(node.iter)}"
        loop_cond_id = self._generate_id("for_loop")
        self._add_node(loop_cond_id, text, shape=('{{"', '"}}'), scope=scope)
        # ... (rest of the for logic is the same)
        self._add_connection(prev_id, loop_cond_id)
        loop_exit_id = self._generate_id("loop_exit")
        self._add_node(loop_exit_id, " ", shape=('{{', '}}'))
        self.loop_stack.append({'start': loop_cond_id, 'exit': loop_exit_id})
        body_end_id = self._process_node_list(node.body, loop_cond_id, scope)
        if node.body:
            for i, conn in reversed(list(enumerate(self.connections))):
                if conn.strip().startswith(f"{loop_cond_id} -->") and '|' not in conn:
                    self.connections[i] = conn.replace("-->", "-->|Each item|")
                    break
        if body_end_id:
            self._add_connection(body_end_id, loop_cond_id, label="Next Iteration")
        self.loop_stack.pop()
        self._add_connection(loop_cond_id, loop_exit_id, label="Done")
        return loop_exit_id

    def _handle_expr(self, node, prev_id, scope):
        if isinstance(node.value, ast.Call):
            call = node.value
            func_name = getattr(call.func, 'id', None)
            if func_name and func_name in self.function_defs:
                # Track nesting relationship between scopes
                self.scope_children.setdefault(scope, set()).add(func_name)
                function_node = self.function_defs[func_name]
                call_id = self._generate_id(f"call_{func_name}")
                self._add_node(call_id, f"Call: {self._get_node_text(node)}", shape=('[["', '"]]'), scope=scope)
                self._add_connection(prev_id, call_id)
                end_call_id = self._generate_id("end_call")
                self._add_node(end_call_id, " ", shape=('{{', '}}'))
                self.call_stack.append(end_call_id)
                # When we enter a function, the scope changes to that function's name
                body_end_id = self._process_node_list(function_node.body, call_id, scope=func_name)
                self.call_stack.pop()
                if body_end_id: self._add_connection(body_end_id, end_call_id)
                return end_call_id

        expr_id = self._generate_id("expr")
        shape = ('[["', '"]]') if isinstance(node.value, ast.Call) else ('["', '"]')
        self._add_node(expr_id, self._get_node_text(node), shape=shape, scope=scope)
        self._add_connection(prev_id, expr_id)
        return expr_id
    
    # Update all other handlers to accept and pass the 'scope' argument
    def _handle_while(self, node, prev_id, scope):
        # ... similar logic to _handle_for, passing `scope` to _process_node_list
        loop_cond_id = self._generate_id("while_loop")
        self._add_node(loop_cond_id, f"While {self._get_node_text(node.test)}", shape=('{"', '"}'), scope=scope)
        self._add_connection(prev_id, loop_cond_id)
        loop_exit_id = self._generate_id("loop_exit")
        self._add_node(loop_exit_id, " ", shape=('{{', '}}'))
        self.loop_stack.append({'start': loop_cond_id, 'exit': loop_exit_id})
        body_end_id = self._process_node_list(node.body, loop_cond_id, scope)
        if body_end_id:
            self.connections[-1] = self.connections[-1].replace('-->', '-->|True|')
            next_iter_id = self._generate_id("next_iter")
            self._add_node(next_iter_id, "*", shape=('[', ']'), scope=scope)
            self._add_connection(body_end_id, next_iter_id)
            self._add_connection(next_iter_id, loop_cond_id)
        self.loop_stack.pop()
        self._add_connection(loop_cond_id, loop_exit_id, label="False")
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
        assign_id = self._generate_id("assign")
        self._add_node(assign_id, self._get_node_text(node), scope=scope)
        self._add_connection(prev_id, assign_id)
        return assign_id

    def _handle_unsupported(self, node, prev_id, scope):
        unsupported_id = self._generate_id("unsupported")
        self._add_node(unsupported_id, f"Unsupported Node: {type(node).__name__}", shape=('[/"', r'\"\]'), scope=scope)
        self._add_connection(prev_id, unsupported_id)
        return unsupported_id
    
    # Break and continue don't create new nodes with context, so they are simpler
    def _handle_break(self, node, prev_id, scope):
        if self.loop_stack: self._add_connection(prev_id, self.loop_stack[-1]['exit'])
        return None

    def _handle_continue(self, node, prev_id, scope):
        if self.loop_stack: self._add_connection(prev_id, self.loop_stack[-1]['start'])
        return None

def main():
    if len(sys.argv) < 2:
        print("Usage: python main.py <python_file_path>", file=sys.stderr)
        sys.exit(1)
    file_path = sys.argv[1]
    if not os.path.exists(file_path):
        print(f"Error: File not found at '{file_path}'", file=sys.stderr)
        sys.exit(1)
    with open(file_path, "r", encoding="utf-8") as f:
        code = f.read()

    builder = FlowchartGenerator()
    mermaid_output, tooltip_data = builder.generate(code)

    # Save the Mermaid flowchart
    output_path_mmd = os.path.join(os.path.dirname(file_path), "flowchart.mmd")
    with open(output_path_mmd, "w", encoding="utf-8") as out:
        out.write(mermaid_output)

    # Save the tooltip data as JSON
    output_path_json = os.path.join(os.path.dirname(file_path), "tooltip_data.json")
    with open(output_path_json, "w", encoding="utf-8") as out:
        json.dump(tooltip_data, out, indent=4)

    print(f"[OK] Mermaid flowchart and data saved.")


if __name__ == "__main__":
    main()