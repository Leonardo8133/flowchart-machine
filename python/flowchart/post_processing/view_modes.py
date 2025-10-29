"""Helpers for applying view mode specific filters."""
from __future__ import annotations

from flowchart.processor.processor import FlowchartProcessor

from .optimization import GraphOptimizer


class ViewModeFilter:
    """Apply view mode specific pruning rules to the processor state."""

    def __init__(self, processor: FlowchartProcessor, optimizer: GraphOptimizer) -> None:
        self._processor = processor
        self._optimizer = optimizer

    def apply(self) -> None:
        view_mode = getattr(self._processor, "view_mode", "detailed")
        if view_mode not in {"compact"}:
            return

        self._remove_empty_init_subgraphs()

        if view_mode == "compact":
            nodes_to_hide = []
            for node_id, node_def in self._processor.nodes.items():
                scope = self._processor.node_scopes.get(node_id, "")
                if self._is_simple_view_noise(node_id, node_def, scope):
                    nodes_to_hide.append(node_id)
            self._optimizer.convert_nodes_to_bypass(nodes_to_hide)
            self._optimizer.optimize_graph()

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------
    def _remove_empty_init_subgraphs(self) -> None:
        init_scopes = [
            scope
            for scope in self._processor.node_scopes.values()
            if scope and scope.endswith("__init__") and scope.startswith("class_")
        ]
        empty_scopes = []
        for scope in init_scopes:
            scope_nodes = [nid for nid, sc in self._processor.node_scopes.items() if sc == scope]
            if not scope_nodes:
                empty_scopes.append(scope)

        for scope in empty_scopes:
            nodes_to_remove = [nid for nid, sc in self._processor.node_scopes.items() if sc == scope]
            for node_id in nodes_to_remove:
                self._processor.node_scopes.pop(node_id, None)
                self._processor.nodes.pop(node_id, None)

        if hasattr(self._processor, "method_subgraphs"):
            for method_key, method_id in list(self._processor.method_subgraphs.items()):
                if not method_key.endswith(".__init__"):
                    continue
                class_name = method_key.split(".")[0]
                scope = f"class_{class_name}__init__"
                if scope in empty_scopes:
                    del self._processor.method_subgraphs[method_key]
                    self._processor.nodes.pop(method_id, None)

    @staticmethod
    def _is_call_view_node(node_id: str, node_def: str | None) -> bool:
        if not node_def:
            return False
        lower = node_def.lower()
        if "call:" in lower or "external:" in lower:
            return True
        if "return" in lower:
            return True
        return node_id.startswith(
            (
                "start",
                "end",
                "merge",
                "call_",
                "method_call",
                "external_call",
                "external_target",
                "end_call",
                "return",
            )
        )

    @staticmethod
    def _is_simple_view_noise(node_id: str, node_def: str | None, scope: str | None) -> bool:
        if not node_def:
            return False
        lower = node_def.lower()
        stripped = lower.strip()
        if "print" in lower:
            return True
        if stripped.startswith("import") or " import " in lower:
            return True
        if any(token in lower for token in ("raise", "except", "assert", " error")):
            return True
        if stripped.startswith("try") or " try " in lower:
            return True
        if stripped.startswith("pass"):
            return True
        if node_id.startswith(("import", "raise", "assert")):
            return True
        if scope and "__init__" in scope:
            return True
        return False

