"""High level orchestration for post-processing a generated flowchart."""
from __future__ import annotations

from flowchart.processor.processor import FlowchartProcessor

from .environment import EnvironmentConfig, load_environment_config
from .mermaid import MermaidBuilder
from .optimization import GraphOptimizer
from .state import PostProcessingState
from .subgraphs import SubgraphManager
from .view_modes import ViewModeFilter


class FlowchartPostProcessor:
    """Coordinate the various post-processing stages."""

    def __init__(self, processor: FlowchartProcessor) -> None:
        self.processor = processor
        self.config: EnvironmentConfig = load_environment_config()
        self.state = PostProcessingState()
        self.subgraphs = SubgraphManager(processor, self.config, self.state)
        self.optimizer = GraphOptimizer(processor, self.config)
        self.view_filter = ViewModeFilter(processor, self.optimizer)
        self.mermaid_builder = MermaidBuilder(processor, self.state, self.subgraphs)

    def post_process(self) -> None:
        print("=== Starting post-processing ===")
        self.subgraphs.preprocess()
        self.optimizer.optimize_graph()
        self.subgraphs.redirect_connections()
        self.view_filter.apply()
        self.optimizer.prune_unreferenced_nodes()
        print("=== Post-processing completed ===")

    def generate_mermaid(self) -> tuple[str, dict]:
        mermaid_string = self.mermaid_builder.build_mermaid()
        metadata = self.mermaid_builder.build_metadata()
        metadata.update(
            {
                "subgraph_whitelist": sorted(self.config.subgraph_whitelist),
                "force_collapse_list": sorted(self.config.force_collapse_list),
            }
        )
        return mermaid_string, metadata

