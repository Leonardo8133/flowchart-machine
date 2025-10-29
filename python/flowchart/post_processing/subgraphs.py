"""Subgraph collapsing and metadata generation logic."""
from __future__ import annotations

import re
from typing import List, Set

from flowchart.processor.processor import FlowchartProcessor

from .environment import EnvironmentConfig
from .state import CollapsedSubgraph, PostProcessingState


class SubgraphManager:
    """Encapsulates logic for collapsing and wiring subgraphs."""

    def __init__(self, processor: FlowchartProcessor, config: EnvironmentConfig, state: PostProcessingState) -> None:
        self._processor = processor
        self._config = config
        self._state = state

    # ------------------------------------------------------------------
    # Collapse detection
    # ------------------------------------------------------------------
    def should_collapse(self, scope: str | None) -> bool:
        if not scope:
            return False
        if scope == "main":
            return False
        entry_name = None
        if getattr(self._processor, "context", None):
            entry_name = self._processor.context.get("entry_name")
        if scope in self._config.force_collapse_list:
            return True
        if scope in self._config.subgraph_whitelist:
            return False
        if entry_name and scope == entry_name:
            return False
        class_name = None
        if scope.startswith("class_") and len(scope) > 6:
            class_name = scope[6:]
        if class_name and class_name in self._config.force_collapse_list:
            return True
        if class_name and class_name in self._config.subgraph_whitelist:
            return False
        return self.get_node_count(scope) > self._config.max_subgraph_nodes

    # ------------------------------------------------------------------
    # Metadata helpers
    # ------------------------------------------------------------------
    def get_node_count(self, scope: str | None) -> int:
        if not scope:
            return 0
        return sum(1 for sc in self._processor.node_scopes.values() if sc == scope)

    def _collect_nested_nodes(self, scope: str, node_set: Set[str]) -> None:
        children = self._processor.scope_children.get(scope, [])
        for child in children:
            child_nodes = [nid for nid, sc in self._processor.node_scopes.items() if sc == child]
            node_set.update(child_nodes)
            self._collect_nested_nodes(child, node_set)

        if scope.startswith("class_") and "_" not in scope[6:]:
            class_name = scope[6:]
            method_scopes = {
                value
                for value in self._processor.node_scopes.values()
                if value and value.startswith(f"class_{class_name}_")
            }
            for method_scope in method_scopes:
                method_nodes = [nid for nid, sc in self._processor.node_scopes.items() if sc == method_scope]
                node_set.update(method_nodes)
                self._collect_nested_nodes(method_scope, node_set)

    def describe_scope(self, scope: str, node_count: int) -> str:
        if scope.startswith("class_"):
            class_body = scope[6:]
            if "_" in class_body:
                _, method_name = class_body.split("_", 1)
                return f"Method: {method_name} ({node_count} nodes)"
            return f"Class: {class_body} ({node_count} nodes)"
        if "_call_" in scope:
            func_name, call_instance = scope.split("_call_", 1)
            return f"Function: {func_name}() - Call {call_instance} ({node_count} nodes)"
        if scope:
            return f"Function: {scope}() ({node_count} nodes)"
        return f"Main Flow ({node_count} nodes)"

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def preprocess(self) -> None:
        scopes = {scope for scope in self._processor.node_scopes.values() if scope}
        for scope in scopes:
            if not self.should_collapse(scope):
                continue
            node_count = self.get_node_count(scope)
            scope_nodes = [nid for nid, sc in self._processor.node_scopes.items() if sc == scope]
            all_nodes = set(scope_nodes)
            self._collect_nested_nodes(scope, all_nodes)
            collapsed_node_id = f"collapsed_nodes__{scope}_{node_count}"
            self._state.collapsed_subgraphs[scope] = CollapsedSubgraph(
                node_count=node_count,
                original_scope=scope,
                subgraph_name=self.describe_scope(scope, node_count),
                collapsed_node_id=collapsed_node_id,
                scope_nodes=sorted(all_nodes),
            )
            for node_id in all_nodes:
                self._processor.nodes.pop(node_id, None)

    def build_collapsed_subgraph(self, scope: str, indent: str) -> List[str]:
        metadata = self._state.collapsed_subgraphs.get(scope)
        if not metadata:
            return []
        lines = [f"{indent}subgraph \"{metadata.subgraph_name}\""]
        lines.append(f"{indent}    {metadata.collapsed_node_id}[\"Collapsed nodes ({metadata.node_count})\"]")
        lines.append(f"{indent}end")
        return lines

    def redirect_connections(self) -> None:
        if not self._state.collapsed_subgraphs:
            return

        node_redirect: dict[str, str] = {}
        for metadata in self._state.collapsed_subgraphs.values():
            for node_id in metadata.scope_nodes:
                node_redirect[node_id] = metadata.collapsed_node_id

        conn_pattern = re.compile(r"\s*(\w+)\s*(<)?-->(?:\|(.*?)\|)?\s*(\w+)\s*")
        new_connections: list[str] = []

        for connection in self._processor.connections:
            match = conn_pattern.match(connection)
            if not match:
                continue
            from_id, bidirectional, label, to_id = match.groups()
            new_from = node_redirect.get(from_id, from_id)
            new_to = node_redirect.get(to_id, to_id)
            if new_from not in self._processor.nodes and new_from != from_id:
                continue
            if new_to not in self._processor.nodes and new_to != to_id:
                continue
            arrow = "<-->" if bidirectional else "-->"
            if label:
                new_connections.append(f"    {new_from} {arrow}|{label}| {new_to}")
            else:
                new_connections.append(f"    {new_from} {arrow} {new_to}")

        for scope, metadata in self._state.collapsed_subgraphs.items():
            scope_nodes = set(metadata.scope_nodes)
            entry_connections: Set[tuple[str, str, str | None, bool]] = set()
            exit_connections: Set[tuple[str, str, str | None, bool]] = set()

            for connection in self._processor.connections:
                match = conn_pattern.match(connection)
                if not match:
                    continue
                from_id, bidirectional, label, to_id = match.groups()
                if to_id in scope_nodes and from_id in self._processor.nodes:
                    entry_connections.add((from_id, metadata.collapsed_node_id, label, bool(bidirectional)))
                if from_id in scope_nodes and to_id in self._processor.nodes:
                    exit_connections.add((metadata.collapsed_node_id, to_id, label, bool(bidirectional)))

            for from_id, to_id, label, bidirectional in sorted(entry_connections):
                arrow = "<-->" if bidirectional else "-->"
                if label:
                    new_connections.append(f"    {from_id} {arrow}|{label}| {to_id}")
                else:
                    new_connections.append(f"    {from_id} {arrow} {to_id}")

            for from_id, to_id, label, bidirectional in sorted(exit_connections):
                arrow = "<-->" if bidirectional else "-->"
                if label:
                    new_connections.append(f"    {from_id} {arrow}|{label}| {to_id}")
                else:
                    new_connections.append(f"    {from_id} {arrow} {to_id}")

        self._processor.connections = new_connections

