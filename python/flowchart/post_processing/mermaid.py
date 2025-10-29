"""Utilities for rendering the final Mermaid diagram and metadata."""
from __future__ import annotations

from dataclasses import asdict
from typing import Dict, List

from flowchart.processor.processor import FlowchartProcessor

from .state import PostProcessingState
from .subgraphs import SubgraphManager


class MermaidBuilder:
    """Compose the final Mermaid source and metadata payload."""

    def __init__(self, processor: FlowchartProcessor, state: PostProcessingState, subgraphs: SubgraphManager) -> None:
        self._processor = processor
        self._state = state
        self._subgraphs = subgraphs

    # ------------------------------------------------------------------
    # Mermaid assembly
    # ------------------------------------------------------------------
    def build_mermaid(self) -> str:
        lines = ["graph TD"]
        if self._processor.nodes:
            lines.append("\t" + "\n\t".join(self._processor.nodes.values()))
        subgraph_lines = self._build_subgraphs()
        if subgraph_lines:
            lines.extend(subgraph_lines)
        connection_lines = self._add_connections()
        if connection_lines:
            lines.extend(connection_lines)
        return "\n".join(lines) + "\n"

    def _build_subgraphs(self) -> List[str]:
        lines: List[str] = []
        visited: set[str] = set()
        view_mode = getattr(self._processor, "view_mode", "detailed")

        def build(scope: str, indent: str) -> None:
            if scope in visited:
                return
            visited.add(scope)
            scope_nodes = [nid for nid, sc in self._processor.node_scopes.items() if sc == scope]

            if (
                view_mode in {"short", "compact"}
                and scope
                and scope.startswith("class_")
                and scope.endswith("__init__")
            ):
                visible_nodes = [
                    nid
                    for nid in scope_nodes
                    if nid in self._processor.nodes and not self._processor.nodes[nid].endswith("{{}}")
                ]
                if not visible_nodes:
                    return

            if not scope_nodes and not (scope and scope.startswith("class_") and scope.count("_") == 1):
                return

            if self._subgraphs.should_collapse(scope):
                lines.extend(self._subgraphs.build_collapsed_subgraph(scope, indent))
                return

            title = self._determine_subgraph_title(scope)
            if title:
                lines.append(f"{indent}subgraph \"{title}\"")

            for node_id in scope_nodes:
                if node_id in self._processor.nodes:
                    lines.append(f"{indent}    {self._processor.nodes[node_id]}")

            if scope and scope.startswith("class_") and scope.count("_") == 1:
                class_name = scope[6:]
                method_scopes = sorted(
                    {
                        value
                        for value in self._processor.node_scopes.values()
                        if value and value.startswith(f"class_{class_name}_")
                    }
                )
                for method_scope in method_scopes:
                    if (
                        view_mode in {"short", "compact"}
                        and method_scope.endswith("__init__")
                    ):
                        method_nodes = [
                            nid for nid, sc in self._processor.node_scopes.items() if sc == method_scope
                        ]
                        visible_nodes = [
                            nid
                            for nid in method_nodes
                            if nid in self._processor.nodes and not self._processor.nodes[nid].endswith("{{}}")
                        ]
                        if not visible_nodes:
                            continue
                    build(method_scope, indent + "    ")
            elif scope in self._processor.scope_children:
                children = sorted(c for c in self._processor.scope_children[scope] if c)
                for child in children:
                    build(child, indent + "    ")

            if title:
                lines.append(f"{indent}end")

        build("main", "")

        class_scopes = sorted(
            {
                f"class_{scope.split('_')[1]}"
                for scope in self._processor.node_scopes.values()
                if scope and scope.startswith("class_") and scope.count("_") >= 2
            }
        )
        for class_scope in class_scopes:
            build(class_scope, "")

        nested_scopes = set()
        for children in self._processor.scope_children.values():
            nested_scopes.update(children)
        function_scopes = sorted(
            {
                scope
                for scope in self._processor.node_scopes.values()
                if scope and not scope.startswith("class_") and scope not in nested_scopes
            }
        )
        for scope in function_scopes:
            scope_nodes = [nid for nid, sc in self._processor.node_scopes.items() if sc == scope]
            if scope_nodes:
                build(scope, "")

        return lines

    def _determine_subgraph_title(self, scope: str | None) -> str | None:
        if not scope:
            return None
        if scope == "main":
            return None
        if scope.startswith("class_"):
            class_body = scope[6:]
            if "_" in class_body:
                _, method_name = class_body.split("_", 1)
                return f"Method: {method_name}"
            return f"Class: {class_body}"
        if "_call_" in scope:
            func_name, call_instance = scope.split("_call_", 1)
            return f"Function: {func_name}() - Call {call_instance}"
        return f"Function: {scope}()"

    def _add_connections(self) -> List[str]:
        return [f"    {connection}" for connection in self._processor.connections]

    # ------------------------------------------------------------------
    # Metadata
    # ------------------------------------------------------------------
    def build_metadata(self) -> Dict[str, object]:
        collapsed = {
            scope: asdict(metadata)
            for scope, metadata in self._state.collapsed_subgraphs.items()
        }
        expanded: Dict[str, Dict[str, object]] = {}
        all_scopes = {
            scope
            for scope in self._processor.node_scopes.values()
            if scope and scope != "main"
        }
        for scope in all_scopes:
            if scope in collapsed:
                continue
            node_count = self._subgraphs.get_node_count(scope)
            expanded[scope] = {
                "node_count": node_count,
                "original_scope": scope,
                "subgraph_name": self._subgraphs.describe_scope(scope, node_count),
                "scope_nodes": [nid for nid, sc in self._processor.node_scopes.items() if sc == scope],
                "status": "expanded",
            }

        for scope, data in collapsed.items():
            data["status"] = "collapsed"

        status_map = {**expanded, **collapsed}
        name_to_line_map = getattr(self._processor, "entry_line_mapping", {})

        return {
            "collapsed_subgraphs": collapsed,
            "expanded_subgraphs": expanded,
            "subgraph_status_map": status_map,
            "all_subgraphs": sorted(all_scopes),
            "file_path": getattr(self._processor, "file_path", None),
            "name_to_line_map": name_to_line_map,
        }

