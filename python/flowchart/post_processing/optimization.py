"""Graph optimisation helpers used by the post processor."""
from __future__ import annotations

import re
from typing import Iterable

from flowchart.processor.processor import FlowchartProcessor

from .environment import EnvironmentConfig


class GraphOptimizer:
    """Utility collection for pruning and simplifying the generated graph."""

    def __init__(self, processor: FlowchartProcessor, config: EnvironmentConfig) -> None:
        self._processor = processor
        self._config = config

    def optimize_graph(self) -> None:
        """Remove bypass nodes and redirect connections accordingly."""
        bypass_nodes = {
            node_id
            for node_id, node_def in self._processor.nodes.items()
            if re.search(r"\{\{\s*\}\}$", node_def)
        }
        if not bypass_nodes:
            return

        conn_pattern = re.compile(r"\s*(\w+)\s*(<)?-->(?:\|(.*?)\|)?\s*(\w+)\s*")
        forwarding_map: dict[str, str] = {}

        for connection in self._processor.connections:
            match = conn_pattern.match(connection)
            if not match:
                continue
            from_id, _, _, to_id = match.groups()
            if from_id in bypass_nodes:
                forwarding_map[from_id] = to_id

        for node_id in list(forwarding_map.keys()):
            visited = {node_id}
            target = forwarding_map.get(node_id)
            while target in forwarding_map:
                next_node = forwarding_map[target]
                if next_node in visited:
                    break
                visited.add(next_node)
                target = next_node
            if target:
                for visited_node in visited:
                    forwarding_map[visited_node] = target

        new_connections: list[str] = []
        for connection in self._processor.connections:
            match = conn_pattern.match(connection)
            if not match:
                continue
            from_id, bidirectional, label, to_id = match.groups()
            if from_id in bypass_nodes:
                continue
            if to_id in forwarding_map:
                to_id = forwarding_map[to_id]
            arrow = "<-->" if bidirectional else "-->"
            if label:
                new_connections.append(f"       {from_id} {arrow}|{label}| {to_id}")
            else:
                new_connections.append(f"       {from_id} {arrow} {to_id}")

        self._processor.connections = new_connections

        for node_id in bypass_nodes:
            self._processor.nodes.pop(node_id, None)

    def prune_unreferenced_nodes(self) -> None:
        """Remove nodes that are no longer referenced by any connection."""
        if not self._config.prune_unused_nodes:
            return

        conn_pattern = re.compile(r"\s*(\w+)\s*-->(?:\|(.*?)\|)?\s*(\w+)\s*")
        referenced: set[str] = set()
        for connection in self._processor.connections:
            match = conn_pattern.match(connection)
            if not match:
                continue
            from_id, _, to_id = match.groups()
            referenced.update({from_id, to_id})

        if getattr(self._processor, "end_id", None):
            referenced.add(self._processor.end_id)

        unused_nodes = set(self._processor.nodes.keys()) - referenced
        if not unused_nodes:
            return

        for node_id in unused_nodes:
            self._processor.nodes.pop(node_id, None)
            self._processor.node_scopes.pop(node_id, None)

    def convert_nodes_to_bypass(self, node_ids: Iterable[str]) -> None:
        """Convert a selection of nodes into Mermaid bypass nodes."""
        essential = {getattr(self._processor, "end_id", None)}
        for node_id in node_ids:
            if not node_id or node_id not in self._processor.nodes:
                continue
            if node_id in essential or node_id.startswith("start"):
                continue
            self._processor.nodes[node_id] = f"{node_id}{{{{}}}}"

