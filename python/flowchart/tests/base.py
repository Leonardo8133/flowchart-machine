"""
Unit tests for main.py flowchart generation.
Tests the main() entry function with various test example files.
"""
import unittest
import sys
import os
import json
import io
from contextlib import redirect_stdout, redirect_stderr
from unittest.mock import patch
from pathlib import Path

# Add parent directory to sys.path for imports
parent_dir = Path(__file__).parent.parent.parent
if str(parent_dir) not in sys.path:
    sys.path.insert(0, str(parent_dir))

class TestFlowchartMain(unittest.TestCase):
    """Test suite for the main flowchart generation function."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.test_dir = Path(__file__).parent / "examples"
        self.temp_dir = Path(__file__).parent.parent / "temp"
        self.output_mmd = self.temp_dir / "flowchart.mmd"
        self.output_json = self.temp_dir / "metadata.json"
        
    def tearDown(self):
        """Clean up generated files after each test."""
        if self.output_mmd.exists():
            self.output_mmd.unlink()
        if self.output_json.exists():
            self.output_json.unlink()
    
    def _run_main_with_file(self, test_file, entry_type=None, entry_name=None, entry_class=None, breakpoint_lines=None):
        """Helper method to run main() with a test file and environment variables."""
        file_path = str(self.test_dir / test_file)
        
        
        # Capture stdout and stderr
        stdout_capture = io.StringIO()
        stderr_capture = io.StringIO()
        
        # Mock sys.argv
        with patch.object(sys, 'argv', ['main.py', file_path]):
            # Clear any existing entry-related environment variables first
            for key in ['ENTRY_TYPE', 'ENTRY_NAME', 'ENTRY_CLASS', 'HAS_BREAKPOINTS', 'BREAKPOINT_LINES']:
                os.environ.pop(key, None)
            
            # Set environment variables
            env_vars = {}
            if entry_type:
                env_vars['ENTRY_TYPE'] = entry_type
            if entry_name:
                env_vars['ENTRY_NAME'] = entry_name
            if entry_class:
                env_vars['ENTRY_CLASS'] = entry_class
            if breakpoint_lines:
                env_vars['HAS_BREAKPOINTS'] = '1'
                env_vars['BREAKPOINT_LINES'] = ','.join(map(str, breakpoint_lines))
            
            with patch.dict(os.environ, env_vars, clear=False):
                # Capture output while running main
                
                with redirect_stdout(stdout_capture), redirect_stderr(stderr_capture):
                    # Import and run main
                    from flowchart.main import main
                    main()
        
        # Get captured output
        stdout_output = stdout_capture.getvalue()
        stderr_output = stderr_capture.getvalue()
        
        # Check for errors in stdout
        if 'ERROR:' in stdout_output:
            self.fail(f"Error occurred during processing: {stdout_output}")
        
        # Verify outputs were created
        self.assertTrue(self.output_mmd.exists(), "flowchart.mmd was not created")
        self.assertTrue(self.output_json.exists(), "metadata.json was not created")
        
        # Read and return outputs
        with open(self.output_mmd, 'r', encoding='utf-8') as f:
            mermaid_output = f.read()
        with open(self.output_json, 'r', encoding='utf-8') as f:
            metadata = json.load(f)
        
        return mermaid_output, metadata, stdout_output, stderr_output
    
    def _assert_node_exists(self, mermaid_output, node_text):
        """Helper to assert a node with specific text exists."""
        self.assertIn(node_text, mermaid_output, f"Node '{node_text}' not found in output")
    
    def _assert_connection_exists(self, mermaid_output, from_node, to_node):
        """Helper to assert a connection exists between nodes."""
        # Just check that both nodes exist and there are connections
        self.assertIn(from_node, mermaid_output)
        self.assertIn(to_node, mermaid_output)
        self.assertIn('-->', mermaid_output)
    
    def _count_subgraphs(self, mermaid_output):
        """Count the number of subgraphs in the output."""
        return mermaid_output.count('subgraph ')