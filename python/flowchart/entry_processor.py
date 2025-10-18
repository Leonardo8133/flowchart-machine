import ast
import logging
import sys

# Configure logging to output to stdout so it appears in VS Code output window
logging.basicConfig(
    level=logging.DEBUG,
    format='%(name)s - %(levelname)s - %(message)s',
    stream=sys.stdout
)

logger = logging.getLogger(__name__)

class EntryProcessor:
    """Processor for the entry point of the code."""

    @classmethod
    def extract_code(cls, code: str, context: dict) -> str:
        """Process the entry point of the code."""
        entry_type = context['entry_type']
        entry_name = context['entry_name']
        entry_class = context['entry_class']
        logger.info(f"Extracting code for entry type: {entry_type}, entry name: {entry_name}, entry class: {entry_class}")
        
        # Create line mapping once for the entire file
        line_mapping = cls.create_line_mapping(code)
        
        # If analyzing entire file, return code as-is
        if entry_type == 'file':
            return code, line_mapping

        # For function/class analysis, create focused snippet
        target_src = None
        call_line = ""
        if entry_type == 'function':
            if entry_class:
                target_src, call_line = cls.process_class_method(code, entry_class, entry_name)
            else:
                target_src, call_line = cls.process_function(code, entry_name)
        elif entry_type == 'class':
            if entry_class and not entry_name:
                target_src, call_line = cls.process_class(code, entry_class, entry_name)
            elif entry_class and entry_name:
                target_src, call_line = cls.process_class_method(code, entry_class, entry_name)

        if target_src:
            code = "\n".join([target_src, call_line])
        return code, line_mapping

    @classmethod
    def create_line_mapping(cls, code: str) -> dict:
        """Create a comprehensive line mapping for all functions, classes, and methods in the file."""
        line_mapping = {}
        parsed = ast.parse(code)
        
        for node in parsed.body:
            if isinstance(node, ast.FunctionDef):
                # Map top-level function
                line_mapping[node.name] = node.lineno
            elif isinstance(node, ast.ClassDef):
                # Map class
                line_mapping[node.name] = node.lineno
                # Map all methods within the class
                for class_node in node.body:
                    if isinstance(class_node, ast.FunctionDef):
                        method_key = f"{node.name}.{class_node.name}"
                        line_mapping[method_key] = class_node.lineno
        
        return line_mapping

    @classmethod
    def append_definitions(cls, code) -> str:
        """Extract all function and class definitions from the code."""
        definitions = []
        parsed = ast.parse(code)
        for node in parsed.body:
            if isinstance(node, ast.FunctionDef) or isinstance(node, ast.ClassDef):
                definitions.append(ast.get_source_segment(code, node))
        return "\n".join(definitions)

    @classmethod
    def process_function(cls, code: str, entry_name: str) -> tuple[str, str]:
        """Process the function entry point of the code."""
        code = cls.append_definitions(code)
        call_line = f"{entry_name}()\n"
        return code, call_line

    @classmethod
    def process_class(cls, code: str, entry_class: str, entry_name: str | None) -> tuple[str, str]:
        """Process the class entry point of the code."""
        code = cls.append_definitions(code)
        call_line = f"{entry_class}()\n"
        return code, call_line

    @classmethod
    def process_class_method(cls, code: str, entry_class: str, entry_name: str) -> tuple[str, str]:
        """Process the class method entry point of the code."""
        code = cls.append_definitions(code)
        call_line = f"{entry_class}.{entry_name}()\n"
        return code, call_line


