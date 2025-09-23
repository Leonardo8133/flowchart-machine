import sys
import os
import json
from flowchart_processor import FlowchartProcessor
from flowchart_postprocessor import FlowchartPostProcessor

class FlowchartGenerator:
    """
    Main flowchart generator that coordinates processing and post-processing.
    """

    def __init__(self):
        self.processor = FlowchartProcessor()
        self.post_processor = FlowchartPostProcessor(self.processor)

    def generate(self, python_code, breakpoint_lines=None):
        """Generate a complete Mermaid flowchart from Python code."""
        try:
            # Set breakpoints AFTER processor is created
            if breakpoint_lines:
                self.processor.set_breakpoints(breakpoint_lines)

            # Step 1: Process the code and create initial structure
            if not self.processor.process_code(python_code):
                return f"graph TD\n    error[\"Error processing code\"]", {}
            
            # Step 2: Post-process the graph (optimize and redirect connections)
            self.post_processor.post_process()
            
            # Step 3: Generate final Mermaid output
            mermaid_output, metadata = self.post_processor.generate_mermaid()
            
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

    builder = FlowchartGenerator()
    mermaid_output, metadata = builder.generate(code, breakpoint_lines)

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


if __name__ == "__main__":
    main()
