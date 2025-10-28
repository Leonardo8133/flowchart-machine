import sys
import os
import json
import ast
from flowchart.processor.processor import FlowchartProcessor   
from flowchart.post_processor import FlowchartPostProcessor
from flowchart.entry_processor import EntryProcessor


class FlowchartGenerator:
    """
    Main flowchart generator that coordinates processing and post-processing.
    """

    def __init__(self):
        self.processor : FlowchartProcessor = FlowchartProcessor()
        self.post_processor : FlowchartPostProcessor = FlowchartPostProcessor(self.processor)

    def generate(self,
        python_code: str,
        context: dict
    ) -> tuple[str, dict]:
        """Generate a complete Mermaid flowchart from Python code.
        Optionally focuses on an entry point (function/class).
        """
        self.processor.file_path = context['file_path']
        self.processor.entry_line_mapping = context['definitions_line_mapping']
        self.processor.context = context
        
        try:
            # Set breakpoints AFTER processor is created
            self.processor.set_breakpoints(context.get('breakpoint_lines', []))

            # Step 1: Process the code and create initial structure
            if not self.processor.process_code(python_code):
                return f"graph TD\n    error[\"Error processing code\"]", {}

            # Step 2: Post-process the graph (optimize and redirect connections)
            self.post_processor.post_process()

            # Step 4: Generate final Mermaid output
            mermaid_output, metadata = self.post_processor.generate_mermaid()
            # Always include entry selection in metadata
            if context['entry_type']:
                metadata['entry_selection'] = { 
                    'type': context['entry_type'], 
                    'name': context['entry_name'] or None,
                    'class': context['entry_class'] or None,
                    'line_offset': context['definitions_line_mapping']
                }
            
            print("=== Flowchart generation completed successfully ===")
            return mermaid_output, metadata

        except Exception as e:
            error_message = f"Error generating flowchart: {e.__class__.__name__} - {e}"
            return f"graph TD\n    error[\"{error_message}\"]", {}


def main():
    """Main function to generate the flowchart."""

    # Validate the arguments
    file_path = validate_args(sys.argv)
    
    with open(file_path, "r", encoding="utf-8") as f:
        code = f.read()

    # Collect the context
    context = collect_context(file_path)

    # Extract the code
    code, line_mapping = EntryProcessor.extract_code(code, context)

    context['definitions_line_mapping'] = line_mapping

    # Generate the flowchart
    mermaid_output, metadata = FlowchartGenerator().generate(code, context)

    # Save the output
    save_output(mermaid_output, metadata)

def validate_args(args: list[str]):
    """Validate the arguments."""
    if len(args) < 2:
        print("Usage: python main.py <python_file_path> [--sequential-flow]", file=sys.stderr)
        print("  --sequential-flow: Use sequential flow mode (one-way arrows instead of Call and Return)", file=sys.stderr)
        sys.exit(1)
    
    # Check for --sequential-flow flag
    if '--sequential-flow' in args:
        os.environ['SEQUENTIAL_FLOW'] = '1'
        # Remove flag from args for file path extraction
        args = [a for a in args if a != '--sequential-flow']
    
    file_path = args[1] 
    if not os.path.exists(file_path):
        print(f"Error: File not found at '{file_path}'", file=sys.stderr)
        sys.exit(1)
    
    return file_path

def collect_context(file_path: str) -> dict:
    """Collect the configuration from the environment."""
    breakpoint_lines = []
    if os.environ.get('HAS_BREAKPOINTS') == '1':
        breakpoint_lines = [int(x) for x in os.environ.get('BREAKPOINT_LINES', '').split(',') if x]
    return {
        'breakpoint_lines': breakpoint_lines,
        'file_path': file_path,
        'entry_type': os.environ.get('ENTRY_TYPE') or None,
        'entry_name': os.environ.get('ENTRY_NAME') or None,
        'entry_class': os.environ.get('ENTRY_CLASS') or None,
    }

def save_output(mermaid_output: str, metadata: dict):
    """Save the Mermaid flowchart and metadata."""
    temp_dir = os.path.join(os.path.dirname(__file__), "temp")
    os.makedirs(temp_dir, exist_ok=True)
    output_path_mmd = os.path.join(temp_dir, "flowchart.mmd")
    with open(output_path_mmd, "w", encoding="utf-8") as out:
        out.write(mermaid_output)
    
    output_path_json = os.path.join(temp_dir, "metadata.json")
    with open(output_path_json, "w", encoding="utf-8") as out:
        json.dump(metadata, out, indent=4)

if __name__ == "__main__":
    main()


