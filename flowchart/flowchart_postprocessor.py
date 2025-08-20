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
		"""Create nested Mermaid subgraph sections based on call hierarchy."""
		lines = []

		def build(scope, indent):
			# Only create subgraph if this scope has visible nodes
			scope_nodes = [nid for nid, sc in self.processor.node_scopes.items() if sc == scope]
			if not scope_nodes:
				return
				
			lines.append("    " * indent + f"subgraph {scope}")
			for nid in scope_nodes:
				lines.append("    " * (indent + 1) + nid)
			for child in sorted(self.processor.scope_children.get(scope, [])):
				build(child, indent + 1)
			lines.append("    " * indent + "end")

		for root_scope in sorted(self.processor.scope_children.get(None, [])):
			build(root_scope, 1)

		return lines

	def clean_mermaid_diagram(self, mermaid_string):
		"""Clean and fix Mermaid diagram syntax to prevent parsing errors."""
		cleaned = mermaid_string
		
		# Remove HTML entities and problematic characters
		cleaned = cleaned.replace('&lt;', '<')
		cleaned = cleaned.replace('&gt;', '>')
		cleaned = cleaned.replace('&amp;', '&')
		
		return cleaned

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
		mermaid_string += "\n".join(self.processor.connections) + "\n"
		mermaid_string += "\n".join(self.processor.click_handlers) + "\n"
		
		# Clean the Mermaid diagram before returning
		cleaned_mermaid = self.clean_mermaid_diagram(mermaid_string)
		
		return cleaned_mermaid, self.processor.tooltip_data
