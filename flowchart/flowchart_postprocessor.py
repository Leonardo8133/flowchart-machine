import re

class FlowchartPostProcessor:
	"""
	Post-processing logic for optimizing and enhancing flowchart connections.
	"""

	def __init__(self, processor):
		self.processor = processor

	def _optimize_graph(self):
		"""Remove bypass nodes and optimize connections."""
		bypass_nodes = {nid for nid, ndef in self.processor.nodes.items() 
					   if re.search(r'\{\{\s*\}\}$', ndef)}
		if not bypass_nodes: 
			return
		
		forwarding_map = {}
		conn_pattern = re.compile(r'\s*(\w+)\s*-->(?:\|(.*?)\|)?\s*(\w+)\s*')
		
		# Build forwarding map
		for conn_str in self.processor.connections:
			match = conn_pattern.match(conn_str)
			if not match: 
				continue
			from_id, _, to_id = match.groups()
			if from_id in bypass_nodes: 
				forwarding_map[from_id] = to_id
		
		# Resolve forwarding chains
		for node_id in list(forwarding_map.keys()):
			visited = {node_id}
			current_target = forwarding_map.get(node_id)
			while current_target in forwarding_map:
				next_node = forwarding_map[current_target]
				if next_node in visited: 
					break
				visited.add(next_node)
				current_target = next_node
			if current_target:
				for visited_node in visited: 
					forwarding_map[visited_node] = current_target
		
		# Rebuild connections
		new_connections = []
		for conn_str in self.processor.connections:
			match = conn_pattern.match(conn_str)
			if not match: 
				continue
			from_id, label, to_id = match.groups()
			if from_id in bypass_nodes: 
				continue
			if to_id in forwarding_map: 
				to_id = forwarding_map[to_id]
			if label: 
				new_connections.append(f'	{from_id} -->|{label}| {to_id}')
			else: 
				new_connections.append(f'	{from_id} --> {to_id}')
		
		self.processor.connections = new_connections
		
		# Remove bypass nodes
		for node_id in bypass_nodes:
			if node_id in self.processor.nodes: 
				del self.processor.nodes[node_id]

	def _parse_connection(self, conn_str):
		"""Parse connection string to extract from_id, label, and to_id."""
		conn_pattern = re.compile(r'\s*(\w+)\s*-->(?:\|(.*?)\|)?\s*(\w+)\s*')
		match = conn_pattern.match(conn_str)
		if match:
			from_id, label, to_id = match.groups()
			return from_id, label or "", to_id
		return None, "", None

	def _redirect_connections_to_subgraphs(self):
		"""Placeholder - no subgraph redirection needed."""
		# Keep connections as-is, no redirection to subgraphs
		pass

	def _build_subgraphs(self):
		"""Create nested Mermaid subgraph sections based on call hierarchy and class structure."""
		lines = []

		def build(scope, indent):
			# Only create subgraph if this scope has visible nodes
			scope_nodes = [nid for nid, sc in self.processor.node_scopes.items() if sc == scope]
			if not scope_nodes:
				return
			
			# Determine subgraph type and name
			if scope and scope.startswith("class_"):
				# Class subgraph
				if "_" in scope[6:]:  # Has method name
					class_name, method_name = scope[6:].split("_", 1)
					subgraph_name = f"Method: {method_name}"
				else:
					class_name = scope[6:]  # Remove "class_" prefix
					subgraph_name = f"Class: {class_name}"
			elif scope:
				# Function subgraph
				subgraph_name = f"Function: {scope}()"
			else:
				# Main scope
				subgraph_name = "Main Flow"
				
			lines.append(f"{indent}subgraph \"{subgraph_name}\"")
			
			# Add nodes for this scope
			for node_id in scope_nodes:
				if node_id in self.processor.nodes:
					lines.append(f"{indent}    {self.processor.nodes[node_id]}")
			
			# Recursively build nested subgraphs
			# For class subgraphs, find and nest method subgraphs
			if scope and scope.startswith("class_") and "_" not in scope[6:]:
				# print("Method scope", scope)
				# This is a class scope, find its methods
				class_name = scope[6:]
				method_scopes = [s for s in self.processor.node_scopes.values() 
							   if s and s.startswith(f"class_{class_name}_")]
				method_scopes = list(set(method_scopes))
				method_scopes.sort()

				# Remove current scope from the list os scopes
				# Build method subgraphs nested inside class
				for method_scope in method_scopes:
					build(method_scope, indent + "    ")
			
			# For other scopes, find their children
			elif scope in self.processor.scope_children:
				children = sorted(self.processor.scope_children[scope])
				for child in children:
					build(child, indent + "    ")
			
			lines.append(f"{indent}end")

		# Build main flow subgraph
		build("main", "")
		
		# Build class subgraphs (these will contain their method subgraphs)
		class_scopes = [s for s in self.processor.node_scopes.values() 
					   if s and s.startswith("class_") and "_" not in s[6:]]
		class_scopes.sort()
		
		for class_scope in class_scopes:
			print("Class scope", class_scope)
			build(class_scope, "")
			print("Finished class scope", class_scope)
		
		# Build function subgraphs
		function_scopes = [s for s in self.processor.node_scopes.values() 
						  if s and not s.startswith("class_") and s != "main"]
		function_scopes.sort()
		
		for function_scope in function_scopes:
			print("Function scope", function_scope)
			build(function_scope, "")

		return lines

	def _add_connections(self):
		"""Add all connections between nodes."""
		lines = []
		
		# Add all connections
		for connection in self.processor.connections:
			lines.append(f"    {connection}")
		
		return lines

	def clean_mermaid_diagram(self, mermaid_string):
		"""Remove floating nodes (nodes that are not connected to anything)."""
		return mermaid_string

	def post_process(self):
		"""Run all post-processing steps."""
		print("=== Starting post-processing ===")
		
		# Step 1: Optimize graph (remove bypass nodes)
		self._optimize_graph()
		
		# Step 2: Keep connections as-is (no subgraph redirection)
		self._redirect_connections_to_subgraphs()
		
		print("=== Post-processing completed ===")

	def generate_mermaid(self):
		"""Generate the final Mermaid diagram string."""
		mermaid_string = "graph TD\n"
		mermaid_string += "\t" + "\n\t".join(self.processor.nodes.values()) + "\n"
		mermaid_string += "\n".join(self._build_subgraphs()) + "\n"
		mermaid_string += "\n".join(self._add_connections()) + "\n"
		mermaid_string += "\n".join(self.processor.click_handlers) + "\n"
		
		
		# Clean the Mermaid diagram before returning
		cleaned_mermaid = self.clean_mermaid_diagram(mermaid_string)
		
		return cleaned_mermaid, self.processor.tooltip_data
