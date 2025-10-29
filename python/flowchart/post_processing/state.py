"""State containers used during post-processing of flowcharts."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List


@dataclass
class CollapsedSubgraph:
    """Metadata describing a collapsed subgraph in the rendered diagram."""

    node_count: int
    original_scope: str
    subgraph_name: str
    collapsed_node_id: str
    scope_nodes: List[str]
    status: str = "collapsed"


@dataclass
class PostProcessingState:
    """Mutable state shared between post-processing components."""

    collapsed_subgraphs: Dict[str, CollapsedSubgraph] = field(default_factory=dict)
