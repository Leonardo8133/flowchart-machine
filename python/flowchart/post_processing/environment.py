"""Helpers for loading post-processing configuration from the environment."""
from __future__ import annotations

from dataclasses import dataclass
import os
from typing import Set

from flowchart.processor.config import FlowchartConfig


@dataclass(frozen=True)
class EnvironmentConfig:
    """Configuration values that influence post-processing behaviour."""

    subgraph_whitelist: Set[str]
    force_collapse_list: Set[str]
    max_subgraph_nodes: int
    prune_unused_nodes: bool


def _parse_list(value: str) -> Set[str]:
    if not value:
        return set()
    return {item.strip() for item in value.split(",") if item.strip()}


def load_environment_config() -> EnvironmentConfig:
    """Create :class:`EnvironmentConfig` based on the current environment."""

    whitelist = _parse_list(os.getenv("SUBGRAPH_WHITELIST", ""))
    force_collapse = _parse_list(os.getenv("FORCE_COLLAPSE_LIST", ""))
    max_nodes = int(os.getenv("MAX_SUBGRAPH_NODES", FlowchartConfig.MAX_SUBGRAPH_NODES))
    prune_unused = os.getenv("PRUNE_UNUSED_NODES", "1") == "1"
    return EnvironmentConfig(
        subgraph_whitelist=whitelist,
        force_collapse_list=force_collapse,
        max_subgraph_nodes=max_nodes,
        prune_unused_nodes=prune_unused,
    )
