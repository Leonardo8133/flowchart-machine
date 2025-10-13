"""Generate a connection-oriented Mermaid diagram for the selected entry point.

The script analyses Python files in the current workspace to determine which
functions call the selected function (callers) and which functions are called by
it (callees). The depth for callers and callees is configurable via environment
variables. Results are stored as JSON in the temp directory so the VS Code
extension can read and display them in a dedicated view.
"""

from __future__ import annotations

import ast
import json
import os
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Set, Tuple

TEMP_FILENAME = "connection_view.json"


@dataclass
class FunctionInfo:
    """Representation of a function or method definition."""

    key: str
    name: str
    file_path: Path
    class_name: Optional[str] = None
    calls: Set[str] = field(default_factory=set)
    call_names: List[str] = field(default_factory=list)

    @property
    def display_name(self) -> str:
        if self.class_name:
            return f"{self.class_name}.{self.name}()"
        return f"{self.name}()"

    @property
    def file_label(self) -> str:
        return str(self.file_path).replace(os.sep, "/")


class CallCollector(ast.NodeVisitor):
    """Collect call expressions within a function."""

    def __init__(self) -> None:
        self.calls: List[str] = []

    def visit_Call(self, node: ast.Call) -> None:  # noqa: N802
        name = self._extract_name(node.func)
        if name:
            self.calls.append(name)
        self.generic_visit(node)

    def _extract_name(self, node: ast.AST) -> Optional[str]:
        if isinstance(node, ast.Name):
            return node.id
        if isinstance(node, ast.Attribute):
            parts: List[str] = []
            current: Optional[ast.AST] = node
            while isinstance(current, ast.Attribute):
                parts.append(current.attr)
                current = current.value
            if isinstance(current, ast.Name):
                parts.append(current.id)
            parts.reverse()
            if parts:
                return ".".join(parts)
        return None


class DefinitionCollector(ast.NodeVisitor):
    """Collect top-level function and method definitions."""

    def __init__(self, file_path: Path, analyzer: "CallGraphAnalyzer") -> None:
        self._file_path = file_path
        self._analyzer = analyzer
        self._class_stack: List[str] = []

    def visit_ClassDef(self, node: ast.ClassDef) -> None:  # noqa: N802
        self._class_stack.append(node.name)
        self.generic_visit(node)
        self._class_stack.pop()

    def visit_FunctionDef(self, node: ast.FunctionDef) -> None:  # noqa: N802
        self._register(node)

    def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef) -> None:  # noqa: N802
        self._register(node)

    def _register(self, node: ast.AST) -> None:
        class_name = self._class_stack[-1] if self._class_stack else None
        func_name = getattr(node, "name", None)
        if not func_name:
            return
        key = self._analyzer.build_key(self._file_path, class_name, func_name)
        info = FunctionInfo(
            key=key,
            name=func_name,
            class_name=class_name,
            file_path=self._file_path,
        )
        collector = CallCollector()
        collector.visit(node)
        info.call_names = collector.calls
        self._analyzer.register_function(info)


class CallGraphAnalyzer:
    """Builds a lightweight call graph for functions within a workspace."""

    def __init__(self, workspace: Path) -> None:
        self.workspace = workspace
        self.functions: Dict[str, FunctionInfo] = {}
        self.simple_index: Dict[str, Set[str]] = {}

    def build_key(self, file_path: Path, class_name: Optional[str], name: str) -> str:
        relative = file_path.relative_to(self.workspace)
        if class_name:
            return f"{relative.as_posix()}::{class_name}.{name}"
        return f"{relative.as_posix()}::{name}"

    def register_function(self, info: FunctionInfo) -> None:
        self.functions[info.key] = info
        self.simple_index.setdefault(info.name, set()).add(info.key)

    def parse_workspace(self) -> None:
        for path in self._iter_python_files(self.workspace):
            try:
                source = path.read_text(encoding="utf-8")
            except (OSError, UnicodeDecodeError):
                continue
            try:
                tree = ast.parse(source)
            except SyntaxError:
                continue
            collector = DefinitionCollector(path, self)
            collector.visit(tree)

    def resolve_calls(self) -> None:
        for info in self.functions.values():
            resolved: Set[str] = set()
            for name in info.call_names:
                target = self._resolve_name(info, name)
                if target:
                    resolved.add(target)
            info.calls = resolved

    def _resolve_name(self, origin: FunctionInfo, name: str) -> Optional[str]:
        if not name:
            return None
        parts = name.split(".")
        simple_name = parts[-1]

        # Prefer methods defined on the same class
        if origin.class_name:
            key = self.build_key(origin.file_path, origin.class_name, simple_name)
            if key in self.functions:
                return key

        # Handle direct references to other classes within the same module
        if len(parts) >= 2:
            candidate_class = parts[-2]
            key = self.build_key(origin.file_path, candidate_class, simple_name)
            if key in self.functions:
                return key

        # Functions within the same module
        key = self.build_key(origin.file_path, None, simple_name)
        if key in self.functions:
            return key

        # Fallback: globally unique name across workspace
        candidates = self.simple_index.get(simple_name)
        if candidates and len(candidates) == 1:
            return next(iter(candidates))
        return None

    def callers(self) -> Dict[str, Set[str]]:
        reverse: Dict[str, Set[str]] = {key: set() for key in self.functions}
        for source, info in self.functions.items():
            for target in info.calls:
                reverse.setdefault(target, set()).add(source)
        return reverse

    @staticmethod
    def _iter_python_files(root: Path) -> Iterable[Path]:
        for path in root.rglob("*.py"):
            # Skip common directories that do not belong to user code
            if any(part.startswith(".") for part in path.parts):
                continue
            yield path


def load_environment() -> Tuple[Path, str, Optional[str], Optional[str], int, int]:
    if len(sys.argv) < 2:
        raise SystemExit("Usage: python connection_view.py <python_file_path>")

    file_path = Path(sys.argv[1]).resolve()
    workspace_root = Path(os.environ.get("WORKSPACE_ROOT", file_path.parent)).resolve()

    entry_type = os.environ.get("ENTRY_TYPE", "file")
    entry_name = os.environ.get("ENTRY_NAME") or None
    entry_class = os.environ.get("ENTRY_CLASS") or None

    caller_depth = int(os.environ.get("CONNECTION_CALLER_DEPTH", "3"))
    callee_depth = int(os.environ.get("CONNECTION_CALLEE_DEPTH", "4"))

    return workspace_root, entry_type, entry_name, entry_class, caller_depth, callee_depth


def resolve_entry(analyzer: CallGraphAnalyzer, file_path: Path, entry_type: str,
                  entry_name: Optional[str], entry_class: Optional[str]) -> Optional[str]:
    if entry_type == "file":
        return None

    try:
        relative = file_path.resolve().relative_to(analyzer.workspace)
    except ValueError:
        return None

    if entry_class:
        key = analyzer.build_key(file_path, entry_class, entry_name or "__init__")
        if key in analyzer.functions:
            return key
        prefix = f"{relative.as_posix()}::{entry_class}."
        for candidate in analyzer.functions:
            if candidate.startswith(prefix):
                return candidate

    if entry_name:
        key = analyzer.build_key(file_path, None, entry_name)
        if key in analyzer.functions:
            return key

    return None


def walk_connections(analyzer: CallGraphAnalyzer, start_key: str, caller_depth: int,
                      callee_depth: int) -> Tuple[Set[str], Set[Tuple[str, str]]]:
    callers_map = analyzer.callers()
    nodes: Set[str] = {start_key}
    edges: Set[Tuple[str, str]] = set()

    # Outbound traversal
    outbound_queue: List[Tuple[str, int]] = [(start_key, 0)]
    visited_out: Set[str] = {start_key}
    while outbound_queue:
        current, depth = outbound_queue.pop(0)
        if depth >= callee_depth:
            continue
        for callee in analyzer.functions[current].calls:
            nodes.add(callee)
            edges.add((current, callee))
            if callee not in visited_out:
                visited_out.add(callee)
                outbound_queue.append((callee, depth + 1))

    # Inbound traversal
    inbound_queue: List[Tuple[str, int]] = [(start_key, 0)]
    visited_in: Set[str] = {start_key}
    while inbound_queue:
        current, depth = inbound_queue.pop(0)
        if depth >= caller_depth:
            continue
        for caller in callers_map.get(current, set()):
            nodes.add(caller)
            edges.add((caller, current))
            if caller not in visited_in:
                visited_in.add(caller)
                inbound_queue.append((caller, depth + 1))

    return nodes, edges


def mermaid_for(nodes: Set[str], edges: Set[Tuple[str, str]],
                analyzer: CallGraphAnalyzer, selected: str) -> str:
    if not nodes:
        return "flowchart LR\n    empty[\"No connection data available\"]"

    lines: List[str] = ["flowchart LR"]
    sorted_nodes = sorted(nodes)

    node_ids: Dict[str, str] = {}
    for index, key in enumerate(sorted_nodes):
        node_ids[key] = f"N{index}"

    # Group nodes by file for subgraphs
    files: Dict[str, List[str]] = {}
    for key in sorted_nodes:
        info = analyzer.functions[key]
        files.setdefault(info.file_label, []).append(key)

    for idx, (file_label, keys) in enumerate(sorted(files.items())):
        subgraph_id = f"SG{idx}"
        safe_label = file_label.replace("\"", "'")
        lines.append(f"  subgraph {subgraph_id}[\"file: {safe_label}\"]")
        for key in keys:
            info = analyzer.functions[key]
            node_id = node_ids[key]
            label = info.display_name.replace("\"", "'")
            lines.append(f"    {node_id}[\"{label}\"]")
        lines.append("  end")

    for source, target in sorted(edges):
        if source in node_ids and target in node_ids:
            lines.append(f"  {node_ids[source]} --> {node_ids[target]}")

    if selected in node_ids:
        lines.append(f"  style {node_ids[selected]} fill:#1177bb,stroke:#ffffff,stroke-width:2px")

    return "\n".join(lines)


def write_output(workspace: Path, mermaid_code: str, metadata: Dict[str, object]) -> None:
    temp_dir = Path(__file__).resolve().parent / "temp"
    temp_dir.mkdir(parents=True, exist_ok=True)
    output_path = temp_dir / TEMP_FILENAME
    with output_path.open("w", encoding="utf-8") as handle:
        json.dump({"mermaid": mermaid_code, "metadata": metadata}, handle, indent=2)


def main() -> None:
    (workspace, entry_type, entry_name, entry_class,
     caller_depth, callee_depth) = load_environment()

    analyzer = CallGraphAnalyzer(workspace)
    analyzer.parse_workspace()
    analyzer.resolve_calls()

    file_path = Path(sys.argv[1]).resolve()
    selected_key = resolve_entry(analyzer, file_path, entry_type, entry_name, entry_class)

    if not selected_key:
        mermaid_code = "flowchart LR\n    note[\"Connection view is available when generating from a function or class\"]"
        metadata = {
            "nodes": 0,
            "edges": 0,
            "reason": "no_entry",
        }
        write_output(workspace, mermaid_code, metadata)
        return

    nodes, edges = walk_connections(analyzer, selected_key, caller_depth, callee_depth)
    mermaid_code = mermaid_for(nodes, edges, analyzer, selected_key)
    metadata = {
        "nodes": len(nodes),
        "edges": len(edges),
        "selected": selected_key,
        "caller_depth": caller_depth,
        "callee_depth": callee_depth,
    }
    write_output(workspace, mermaid_code, metadata)


if __name__ == "__main__":
    main()
