import sys
import os
import json
import ast
from flowchart_processor import FlowchartProcessor
from flowchart_postprocessor import FlowchartPostProcessor

class FlowchartGenerator:
    """
    Main flowchart generator that coordinates processing and post-processing.
    """

    def __init__(self):
        self.processor = FlowchartProcessor()
        self.post_processor = FlowchartPostProcessor(self.processor)

    def generate(self, python_code, breakpoint_lines=None, entry_type: str | None = None, entry_name: str | None = None):
        """Generate a complete Mermaid flowchart from Python code.
        Optionally focuses on an entry point (function/class).
        """
        try:
            # Set breakpoints AFTER processor is created
            if breakpoint_lines:
                self.processor.set_breakpoints(breakpoint_lines)

            # Step 1: Process the code and create initial structure
            if not self.processor.process_code(python_code):
                return f"graph TD\n    error[\"Error processing code\"]", {}

            # Step 2: Post-process the graph (optimize and redirect connections)
            self.post_processor.post_process()

            # Step 4: Generate final Mermaid output
            mermaid_output, metadata = self.post_processor.generate_mermaid()
            # Always include entry selection in metadata
            if entry_type:
                metadata['entry_selection'] = { 'type': entry_type, 'name': entry_name or None}
            
            print("=== Flowchart generation completed successfully ===")
            return mermaid_output, metadata

        except Exception as e:
            error_message = f"Error generating flowchart: {e.__class__.__name__} - {e}"
            return f"graph TD\n    error[\"{error_message}\"]", {}


def main():
    if len(sys.argv) < 2:
        print("Usage: python main.py <python_file_path>", file=sys.stderr)
        sys.exit(1)
    
    file_path = sys.argv[1]
    if not os.path.exists(file_path):
        print(f"Error: File not found at '{file_path}'", file=sys.stderr)
        sys.exit(1)
    
    with open(file_path, "r", encoding="utf-8") as f:
        code = f.read()

    # Get breakpoint information from environment
    breakpoint_lines = []
    if os.environ.get('HAS_BREAKPOINTS') == '1':
        breakpoint_lines = [int(x) for x in os.environ.get('BREAKPOINT_LINES', '').split(',') if x]

    # Read entry selection from environment
    entry_type = os.environ.get('ENTRY_TYPE') or None
    entry_name = os.environ.get('ENTRY_NAME') or None
    entry_line_offset = int(os.environ.get('ENTRY_LINE_OFFSET', '0'))
    print(f"Python received: ENTRY_TYPE={entry_type}, ENTRY_NAME={entry_name}, ENTRY_LINE_OFFSET={entry_line_offset}")

    code = process_entry(code, entry_type, entry_name)

    builder = FlowchartGenerator()
    # Expose the file path to the processor for metadata context
    try:
        builder.processor.file_path = file_path
        builder.processor.entry_line_offset = entry_line_offset
    except Exception:
        pass
    mermaid_output, metadata = builder.generate(code, breakpoint_lines, entry_type, entry_name)

    # Save the Mermaid flowchart
    temp_dir = os.path.join(os.path.dirname(__file__), "temp")
    os.makedirs(temp_dir, exist_ok=True)
    output_path_mmd = os.path.join(temp_dir, "flowchart.mmd")
    with open(output_path_mmd, "w", encoding="utf-8") as out:
        out.write(mermaid_output)

    # Save the metadata as JSON
    output_path_json = os.path.join(temp_dir, "metadata.json")
    with open(output_path_json, "w", encoding="utf-8") as out:
        json.dump(metadata, out, indent=4)

    print(f"[OK] Mermaid flowchart and data saved.")


def process_entry(code: str, entry_type: str, entry_name: str | None) -> str:
    """Process the entry point of the code."""

    # If analyzing entire file, return code as-is
    if entry_type == 'file' or not entry_name:
        return code

    # For function/class analysis, create focused snippet
    parsed = ast.parse(code)
    target_src = None
    call_line = ""

    if entry_type == 'function':
        for node in parsed.body:
            if isinstance(node, ast.FunctionDef) and node.name == entry_name:
                target_src = ast.get_source_segment(code, node)
                break
        call_line = f"\n\n{entry_name}()\n"
    elif entry_type == 'class':
        for node in parsed.body:
            if isinstance(node, ast.ClassDef) and node.name == entry_name:
                target_src = ast.get_source_segment(code, node)
                break
        call_line = f"\n\n{entry_name}()\n"
    
    if target_src:
        code = "\n".join([target_src, call_line])
    return code

if __name__ == "__main__":
    main()
