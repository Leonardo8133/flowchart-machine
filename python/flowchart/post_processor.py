"""Backwards compatible entry point for post-processing utilities."""
from __future__ import annotations

import os
import re
from flowchart.post_processing import FlowchartPostProcessor
from flowchart.processor.config import FlowchartConfig

class FlowchartPostProcessor:
	def __init__(self, processor):
		self.processor = processor
		# Clear class variables to prevent state bleeding between tests
		FlowchartPostProcessor.collapsed_subgraphs = {}
		FlowchartPostProcessor.subgraph_whitelist = set()
		FlowchartPostProcessor.force_collapse_list = set()
		self._load_whitelist_from_env()

	def _load_whitelist_from_env(self):
		"""Load whitelist and force collapse list from environment variables."""
		# Load whitelist
		whitelist_env = os.getenv('SUBGRAPH_WHITELIST', '')
		if whitelist_env:
			whitelist_items = [item.strip() for item in whitelist_env.split(',') if item.strip()]
			FlowchartPostProcessor.subgraph_whitelist = set(whitelist_items)
			print(f"Loaded whitelist: {FlowchartPostProcessor.subgraph_whitelist}")
		else:
			FlowchartPostProcessor.subgraph_whitelist = set()
		
		# Load force collapse list
		force_collapse_env = os.getenv('FORCE_COLLAPSE_LIST', '')
		if force_collapse_env:
			force_collapse_items = [item.strip() for item in force_collapse_env.split(',') if item.strip()]
			FlowchartPostProcessor.force_collapse_list = set(force_collapse_items)
			print(f"Loaded force collapse list: {FlowchartPostProcessor.force_collapse_list}")
		else:
			FlowchartPostProcessor.force_collapse_list = set()

	def _get_scope_identifier(self, scope):
		"""Generate unique scope identifier in format (file-parent)/(file-name)/function-name."""
		if not scope:
			return None
		
		# Get file information from processor if available
		file_path = getattr(self.processor, 'file_path', '')
		if file_path:
			# Extract parent directory and filename
			parent_dir = os.path.basename(os.path.dirname(file_path))
			file_name = os.path.splitext(os.path.basename(file_path))[0]
			return f"({parent_dir})/({file_name})/{scope}"
		else:
			# Fallback to just scope name if no file path
			return scope

	def _optimize_graph(self):
		"""Remove bypass nodes and optimize connections."""
		bypass_nodes = {nid for nid, ndef in self.processor.nodes.items() 
					   if re.search(r'\{\{\s*\}\}$', ndef)}
		if not bypass_nodes: 
			return
		
		forwarding_map = {}
		# Updated pattern to match both --> and <--> arrows
		conn_pattern = re.compile(r'\s*(\w+)\s*(<)?-->(?:\|(.*?)\|)?\s*(\w+)\s*')
		
		# Build forwarding map
		for conn_str in self.processor.connections:
			match = conn_pattern.match(conn_str)
			if not match: 
				continue
			from_id, bidirectional, _, to_id = match.groups()
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
			from_id, bidirectional, label, to_id = match.groups()
			if from_id in bypass_nodes: 
				continue
			if to_id in forwarding_map: 
				to_id = forwarding_map[to_id]
			# Preserve bidirectional arrows
			arrow = '<-->' if bidirectional else '-->'
			if label: 
				new_connections.append(f'	{from_id} {arrow}|{label}| {to_id}')
			else: 
				new_connections.append(f'	{from_id} {arrow} {to_id}')
		
		self.processor.connections = new_connections
		
		# Remove bypass nodes
		for node_id in bypass_nodes:
			if node_id in self.processor.nodes: 
				del self.processor.nodes[node_id]

	def _prune_unreferenced_nodes(self):
		"""Remove nodes not referenced by any remaining connections.

		This hides floating/unused nodes. Works for functions and classes alike
		because pruning is purely connection-based and scope-agnostic.
		Controlled via env PRUNE_UNUSED_NODES (default: enabled).
		"""
		if os.getenv('PRUNE_UNUSED_NODES', '1') != '1':
			return

		# Collect referenced ids from connections
		referenced = set()
		conn_pattern = re.compile(r'\s*(\w+)\s*-->(?:\|(.*?)\|)?\s*(\w+)\s*')
		for conn_str in self.processor.connections:
			match = conn_pattern.match(conn_str)
			if not match:
				continue
			from_id, _, to_id = match.groups()
			referenced.add(from_id)
			referenced.add(to_id)

		# Always keep End if present
		if getattr(self.processor, 'end_id', None):
			referenced.add(self.processor.end_id)

		# Remove nodes not referenced
		all_ids = set(self.processor.nodes.keys())
		to_delete = all_ids - referenced
		if not to_delete:
			return

		for nid in to_delete:
			self.processor.nodes.pop(nid, None)
			self.processor.node_scopes.pop(nid, None)

	def _parse_connection(self, conn_str):
		"""Parse connection string to extract from_id, label, and to_id."""
		conn_pattern = re.compile(r'\s*(\w+)\s*-->(?:\|(.*?)\|)?\s*(\w+)\s*')
		match = conn_pattern.match(conn_str)
		if match:
			from_id, label, to_id = match.groups()
			return from_id, label or "", to_id
		return None, "", None

	def _is_subgraph_too_large(self, scope):
		"""
		Check if a subgraph should be collapsed based on priority rules.
		
		Priority order (highest to lowest):
		1. Force collapse EXACT match - highest priority
		2. Whitelist EXACT match - second priority
		3. Entry point protection - third priority
		4. Force collapse PATTERN match - fourth priority
		5. Whitelist PATTERN match - fifth priority
		6. Size-based - lowest priority
		"""
		# 1. Force collapse EXACT match - highest priority
		if scope in FlowchartPostProcessor.force_collapse_list:
			return True
		
		# 2. Whitelist EXACT match - second priority
		if scope in FlowchartPostProcessor.subgraph_whitelist:
			return False
		
		# 3. Entry point protection - third priority
		if hasattr(self, 'entry_name') and self.entry_name and scope == self.entry_name:
			return False
		
		# 4 & 5. Extract class name for pattern matching (if applicable)
		class_name = None
		if scope.startswith("class_") and len(scope) > 6:
			class_name = scope[6:]  # Remove "class_" prefix
		
		# 4. Force collapse PATTERN match - fourth priority
		if class_name and class_name in FlowchartPostProcessor.force_collapse_list:
			return True
		
		# 5. Whitelist PATTERN match - fifth priority
		if class_name and class_name in FlowchartPostProcessor.subgraph_whitelist:
			return False
		
		# 6. Size-based - lowest priority
		max_subgraph_nodes = int(os.getenv('MAX_SUBGRAPH_NODES', FlowchartConfig.MAX_SUBGRAPH_NODES))
		
		scope_nodes = [nid for nid, sc in self.processor.node_scopes.items() if sc == scope]
		return len(scope_nodes) > max_subgraph_nodes

	def _get_subgraph_node_count(self, scope):
		"""Get the number of nodes in a subgraph scope."""
		scope_nodes = [nid for nid, sc in self.processor.node_scopes.items() if sc == scope]
		return len(scope_nodes)
	
	def _get_subgraph_name(self, scope, node_count):
		"""Get the display name for a subgraph scope."""
		if scope and scope.startswith("class_"):
			if "_" in scope[6:]:  # Has method name
				class_name, method_name = scope[6:].split("_", 1)
				return f"Method: {method_name}"
			else:
				class_name = scope[6:]  # Remove "class_" prefix
				return f"Class: {class_name}"
		elif scope and "_call_" in scope:
			# Function call instance subgraph
			func_name, call_instance = scope.split("_call_", 1)
			return f"Function: {func_name}() - Call {call_instance}"
		elif scope:
			# Function subgraph
			return f"Function: {scope}()"
		else:
			# Fallback for empty scope
			return "Main Flow"

	def _build_collapsed_subgraph(self, scope, indent, lines):
		"""Build a collapsed subgraph for large scopes."""
		if scope not in FlowchartPostProcessor.collapsed_subgraphs:
			return
		
		metadata = FlowchartPostProcessor.collapsed_subgraphs[scope]
		node_count = metadata["node_count"]
		subgraph_name = metadata["subgraph_name"]
		
		collapsed_node_id = f"collapsed_nodes__{scope}_{node_count}"
		# Generate collapsed subgraph with Mermaid's collapsible syntax
		lines.append(f'{indent}subgraph "{subgraph_name}"')
		lines.append(f'{indent}    {collapsed_node_id}["Collapsed nodes ({node_count})"]')
		lines.append(f'{indent}end')

	def _redirect_connections_to_subgraphs(self):
		"""Redirect connections to collapsed subgraphs."""
		if not FlowchartPostProcessor.collapsed_subgraphs:
			return
		
		# Create a mapping from original node IDs to collapsed node IDs
		node_redirect_map = {}
		for scope, metadata in FlowchartPostProcessor.collapsed_subgraphs.items():
			collapsed_node_id = metadata["collapsed_node_id"]
			scope_nodes = metadata["scope_nodes"]
			
			# Map all nodes in this scope to the collapsed node
			for node_id in scope_nodes:
				node_redirect_map[node_id] = collapsed_node_id
		
		# Update connections to redirect to collapsed nodes
		new_connections = []
		for connection in self.processor.connections:
			# Parse connection with support for bidirectional arrows
			conn_pattern = re.compile(r'\s*(\w+)\s*(<)?-->(?:\|(.*?)\|)?\s*(\w+)\s*')
			match = conn_pattern.match(connection)
			if match:
				from_id, bidirectional, label, to_id = match.groups()
				# Redirect both from and to nodes if they're in collapsed subgraphs
				new_from_id = node_redirect_map.get(from_id, from_id)
				new_to_id = node_redirect_map.get(to_id, to_id)
				
				# Only keep connections that don't point to deleted nodes
				if new_from_id in self.processor.nodes or new_from_id == from_id:
					if new_to_id in self.processor.nodes or new_to_id == to_id:
						# Rebuild the connection string with bidirectional support
						arrow = '<-->' if bidirectional else '-->'
						if label:
							new_connections.append(f'    {new_from_id} {arrow}|{label}| {new_to_id}')
						else:
							new_connections.append(f'    {new_from_id} {arrow} {new_to_id}')
		
		# Add connections for collapsed subgraphs
		for scope, metadata in FlowchartPostProcessor.collapsed_subgraphs.items():
			collapsed_node_id = metadata["collapsed_node_id"]
			scope_nodes = metadata["scope_nodes"]
			
			# Find connections that go into this scope (from outside to inside)
			entry_connections = set()
			for connection in self.processor.connections:
				conn_pattern = re.compile(r'\s*(\w+)\s*(<)?-->(?:\|(.*?)\|)?\s*(\w+)\s*')
				match = conn_pattern.match(connection)
				if match:
					from_id, bidirectional, label, to_id = match.groups()
					if from_id and to_id and to_id in scope_nodes:
						# This connection goes into the collapsed scope
						if from_id in self.processor.nodes:
							conn_key = (from_id, collapsed_node_id, label, bidirectional)
							if conn_key not in entry_connections:
								entry_connections.add(conn_key)
								# Preserve bidirectional arrows for method calls
								arrow = '<-->' if bidirectional else '-->'
								if label:
									new_connections.append(f'    {from_id} {arrow}|{label}| {collapsed_node_id}')
								else:
									new_connections.append(f'    {from_id} {arrow} {collapsed_node_id}')
			
			# Find connections that come out of this scope (from inside to outside)
			exit_connections = set()
			for connection in self.processor.connections:
				conn_pattern = re.compile(r'\s*(\w+)\s*(<)?-->(?:\|(.*?)\|)?\s*(\w+)\s*')
				match = conn_pattern.match(connection)
				if match:
					from_id, bidirectional, label, to_id = match.groups()
					if from_id and to_id and from_id in scope_nodes:
						# This connection comes out of the collapsed scope
						if to_id in self.processor.nodes:
							conn_key = (collapsed_node_id, to_id, label, bidirectional)
							if conn_key not in exit_connections:
								exit_connections.add(conn_key)
								# Preserve bidirectional arrows for method calls
								arrow = '<-->' if bidirectional else '-->'
								if label:
									new_connections.append(f'    {collapsed_node_id} {arrow}|{label}| {to_id}')
								else:
									new_connections.append(f'    {collapsed_node_id} {arrow} {to_id}')
		
		self.processor.connections = new_connections

	def _preprocess_collapsed_subgraphs(self):
		"""Preprocess and identify subgraphs that should be collapsed."""
		# Find all scopes that should be collapsed
		scopes_to_collapse = []
		for scope in set(self.processor.node_scopes.values()):
			if scope and scope != "main" and self._is_subgraph_too_large(scope):
				scopes_to_collapse.append(scope)
		
		# Collapse each large subgraph
		for scope in scopes_to_collapse:
			node_count = self._get_subgraph_node_count(scope)
			
			# Determine subgraph name
			if scope and scope.startswith("class_"):
				if "_" in scope[6:]:  # Has method name
					class_name, method_name = scope[6:].split("_", 1)
					subgraph_name = f"Method: {method_name} ({node_count} nodes)"
				else:
					class_name = scope[6:]  # Remove "class_" prefix
					subgraph_name = f"Class: {class_name} ({node_count} nodes)"
			elif scope and "_call_" in scope:
				# Function call instance subgraph
				func_name, call_instance = scope.split("_call_", 1)
				subgraph_name = f"Function: {func_name}() - Call {call_instance} ({node_count} nodes)"
			elif scope:
				# Function subgraph
				subgraph_name = f"Function: {scope}() ({node_count} nodes)"
			else:
				# Fallback for empty scope
				subgraph_name = f"Main Flow ({node_count} nodes)"
			
			# Store metadata for potential expansion
			scope_nodes = [nid for nid, sc in self.processor.node_scopes.items() if sc == scope]
			
			# Get all nodes from nested subgraphs as well
			all_nodes_to_remove = set(scope_nodes)
			self._collect_nested_nodes(scope, all_nodes_to_remove)
			collapsed_node_id = f"collapsed_nodes__{scope}_{node_count}"

			FlowchartPostProcessor.collapsed_subgraphs[scope] = {
				"node_count": node_count,
				"original_scope": scope,
				"subgraph_name": subgraph_name,
				"collapsed_node_id": collapsed_node_id,
				"scope_nodes": list(all_nodes_to_remove),
				"status": "collapsed"
			}
			
			# Remove all nodes (including nested ones) from main flow
			for node_id in all_nodes_to_remove:
				if node_id in self.processor.nodes:
					del self.processor.nodes[node_id]

	def _collect_nested_nodes(self, scope, node_set):
		"""Recursively collect all nodes from nested subgraphs."""
		if scope in self.processor.scope_children:
			for child_scope in self.processor.scope_children[scope]:
				child_nodes = [nid for nid, sc in self.processor.node_scopes.items() if sc == child_scope]
				node_set.update(child_nodes)
				self._collect_nested_nodes(child_scope, node_set)
		
		if scope and scope.startswith("class_") and "_" not in scope[6:]:
			class_name = scope[6:]
			method_scopes = [s for s in self.processor.node_scopes.values() 
						   if s and s.startswith(f"class_{class_name}_")]
			for method_scope in method_scopes:
				method_nodes = [nid for nid, sc in self.processor.node_scopes.items() if sc == method_scope]
				node_set.update(method_nodes)
				self._collect_nested_nodes(method_scope, node_set)

	def _build_subgraphs(self):
		"""Create nested Mermaid subgraph sections based on call hierarchy and class structure."""
		lines = []
		visited_scopes = set()  # Track visited scopes to prevent infinite recursion

		def build(scope, indent):
			# Prevent infinite recursion
			if scope in visited_scopes:
				return
			visited_scopes.add(scope)
			# Only create subgraph if this scope has visible nodes
			# Exception: class scopes can be created even without nodes (they contain method subgraphs)
			scope_nodes = [nid for nid, sc in self.processor.node_scopes.items() if sc == scope]
			if not scope_nodes and not (scope and scope.startswith("class_") and scope.count("_") == 1):
				return
			
			# Check if subgraph is too large and should be collapsed
			# Don't collapse the main scope - it should always be visible
			if scope != "main" and self._is_subgraph_too_large(scope):
				self._build_collapsed_subgraph(scope, indent, lines)
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
			elif scope == "main":
				# Main flow - don't create a subgraph, just add nodes directly
				subgraph_name = None
			elif scope and "_call_" in scope:
				# Function call instance subgraph
				func_name, call_instance = scope.split("_call_", 1)
				subgraph_name = f"Function: {func_name}() - Call {call_instance}"
			elif scope:
				# Function subgraph
				subgraph_name = f"Function: {scope}()"
			else:
				# Fallback for empty scope
				subgraph_name = "Main Flow"
			
			if subgraph_name:
				lines.append(f"{indent}subgraph \"{subgraph_name}\"")
			
			# Add nodes for this scope
			for node_id in scope_nodes:
				if node_id in self.processor.nodes:
					lines.append(f"{indent}    {self.processor.nodes[node_id]}")

			# For class subgraphs, find and nest method subgraphs
			if scope and scope.startswith("class_") and "_" not in scope[6:]:
				# This is a class scope, find its methods
				class_name = scope[6:]
				method_scopes = [s for s in self.processor.node_scopes.values() 
							   if s and s.startswith(f"class_{class_name}_")]
				method_scopes = sorted(list(set([s for s in method_scopes if s is not None])))

				# Remove current scope from the list os scopes
				# Build method subgraphs nested inside class
				for method_scope in method_scopes:
					build(method_scope, indent + "    ")
			
			# For other scopes, find their children
			elif scope in self.processor.scope_children:
				children = sorted([c for c in self.processor.scope_children[scope] if c is not None])
				for child in children:
					build(child, indent + "    ")
			
			if subgraph_name:
				lines.append(f"{indent}end")

		# Build main flow subgraph
		build("main", "")
		
		# Build class subgraphs (these will contain their method subgraphs)
		# Look for class definition scopes by finding method scopes and extracting class names
		# Method scopes have format: class_ClassName_methodName
		# We can infer class scopes from method scopes
		class_scopes = set()
		for node_id, scope in self.processor.node_scopes.items():
			if scope and scope.startswith("class_") and scope.count("_") >= 2:
				# This is a method scope, extract the class name
				parts = scope.split("_")
				if len(parts) >= 3:  # class_ClassName_methodName
					class_name = parts[1]
					class_scope = f"class_{class_name}"
					class_scopes.add(class_scope)
		class_scopes = sorted(list(class_scopes))
		
		for class_scope in class_scopes:
			build(class_scope, "")
		
		# Build function subgraphs - only for scopes that have actual nodes
		# Filter out nested scopes (those that are children of other scopes)
		all_nested_scopes = set()
		for parent_scope, children in self.processor.scope_children.items():
			all_nested_scopes.update(children)
		
		function_scopes = [s for s in self.processor.node_scopes.values() 
						  if s and not s.startswith("class_") and s not in all_nested_scopes]
		function_scopes = sorted(list(set([s for s in function_scopes if s is not None])))
		for function_scope in function_scopes:
			# Only build subgraph if this scope has visible nodes
			scope_nodes = [nid for nid, sc in self.processor.node_scopes.items() if sc == function_scope]
			if scope_nodes:  # Only create subgraph if there are actual nodes
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
		
		# Step 1: Preprocess collapsed subgraphs (remove large subgraph nodes)
		self._preprocess_collapsed_subgraphs()
		
		# Step 2: Optimize graph (remove bypass nodes)
		self._optimize_graph()
		
		# Step 3: Redirect connections to collapsed subgraphs
		self._redirect_connections_to_subgraphs()

		# Step 4: Prune unreferenced nodes (functions and classes)
		self._prune_unreferenced_nodes()
		
		print("=== Post-processing completed ===")

	def generate_mermaid(self):
		"""Generate the final Mermaid diagram string."""
		mermaid_string = "graph TD\n"
		mermaid_string += "\t" + "\n\t".join(self.processor.nodes.values()) + "\n"
		mermaid_string += "\n".join(self._build_subgraphs()) + "\n"
		mermaid_string += "\n".join(self._add_connections()) + "\n"
		
		
		# Clean the Mermaid diagram before returning
		cleaned_mermaid = self.clean_mermaid_diagram(mermaid_string)
		
		# Build unified name-to-line mapping from all definitions
		name_to_line_map = self.processor.entry_line_mapping if hasattr(self.processor, 'entry_line_mapping') else {}
		
		# Get all available subgraphs from node_scopes
		all_subgraphs = list(set(self.processor.node_scopes.values()))
		# Filter out None, empty strings, and main scope
		all_subgraphs = [scope for scope in all_subgraphs if scope and scope != "main"]
		
		# Calculate expanded subgraphs (all_subgraphs - collapsed_subgraphs)
		expanded_subgraphs = {}
		for scope in all_subgraphs:
			if scope not in FlowchartPostProcessor.collapsed_subgraphs:
				node_count = self._get_subgraph_node_count(scope)
				expanded_subgraphs[scope] = {
					"node_count": node_count,
					"original_scope": scope,
					"subgraph_name": self._get_subgraph_name(scope, node_count),
					"status": "expanded"
				}
		
		# Create subgraph status map
		subgraph_status_map = {}
		for scope in all_subgraphs:
			if scope in FlowchartPostProcessor.collapsed_subgraphs:
				subgraph_status_map[scope] = "collapsed"
			else:
				subgraph_status_map[scope] = "expanded"
		
		# Return collapsed subgraphs metadata and configuration data
		# Convert sets to lists for JSON serialization
		metadata = {
			"collapsed_subgraphs": FlowchartPostProcessor.collapsed_subgraphs,
			"expanded_subgraphs": expanded_subgraphs,
			"subgraph_status_map": subgraph_status_map,
			"subgraph_whitelist": list(FlowchartPostProcessor.subgraph_whitelist),
			"force_collapse_list": list(FlowchartPostProcessor.force_collapse_list),
			"all_subgraphs": all_subgraphs,  # Add all available subgraphs
			# Include node to source line mapping when available (adjusted for entry offset)
			# Include file path to help consumers locate the file
			"file_path": getattr(self.processor, 'file_path', None),
			# Unified mapping for all definitions
			"name_to_line_map": name_to_line_map
		}
		return cleaned_mermaid, metadata
