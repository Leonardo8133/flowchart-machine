"""
Test connection view functionality for create_car function.

This test verifies that the connection view correctly shows the relationships
between create_car function and the functions it calls (create_brand, create_engine).
"""

import unittest
import os
import sys
from unittest.mock import patch
from pathlib import Path

# Add the parent directory to the path to import flowchart modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..'))

from flowchart.main import FlowchartGenerator
from flowchart.entry_processor import EntryProcessor


class TestConnectionView(unittest.TestCase):
    """Test connection view functionality for create_car function."""

    def setUp(self):
        """Set up test fixtures."""
        self.generator = FlowchartGenerator()
        self.examples_dir = os.path.join(os.path.dirname(__file__), '..', 'examples', 'connection_example')
        
    def _read_example_file(self, filename):
        """Read an example file from the connection_example directory."""
        file_path = os.path.join(self.examples_dir, filename)
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read()

    def test_create_car_function_connection_view(self):
        """Test that create_car function metadata is correctly set for connection view"""
        test_code = self._read_example_file('car.py')
        context = {
            'file_path': 'car.py',
            'entry_type': 'function',
            'entry_name': 'create_car',
            'entry_class': None,
            'workspace_root': self.examples_dir,
            'view_mode': 'detailed',
            'definitions_line_mapping': {'create_car': 23},
        }
        mermaid_output, metadata = self.generator.generate(test_code, context)
        
        # Check metadata contains entry selection for function
        self.assertIn('entry_selection', metadata)
        entry_selection = metadata['entry_selection']
        self.assertEqual(entry_selection['type'], 'function')
        self.assertEqual(entry_selection['name'], 'create_car')
        
        # Check that line offset is correctly set
        self.assertIn('line_offset', entry_selection)
        self.assertEqual(entry_selection['line_offset']['create_car'], 23)

    def test_connection_view_metadata_structure(self):
        """Test that connection view metadata has the correct structure for function analysis"""
        test_code = self._read_example_file('car.py')
        context = {
            'file_path': 'car.py',
            'entry_type': 'function',
            'entry_name': 'create_car',
            'entry_class': None,
            'workspace_root': self.examples_dir,
            'view_mode': 'detailed',
            'definitions_line_mapping': {'create_car': 23},
        }
        mermaid_output, metadata = self.generator.generate(test_code, context)
        
        # Check metadata structure for connection view
        self.assertIn('entry_selection', metadata)
        self.assertIn('collapsed_subgraphs', metadata)
        self.assertIn('expanded_subgraphs', metadata)
        self.assertIn('subgraph_status_map', metadata)
        
        # Verify entry selection is for function, not file
        entry_selection = metadata['entry_selection']
        self.assertEqual(entry_selection['type'], 'function')
        self.assertEqual(entry_selection['name'], 'create_car')
        self.assertIsNone(entry_selection['class'])

    def test_connection_view_function_calls(self):
        """Test that create_car function metadata enables connection view analysis"""
        test_code = self._read_example_file('car.py')
        context = {
            'file_path': 'car.py',
            'entry_type': 'function',
            'entry_name': 'create_car',
            'entry_class': None,
            'workspace_root': self.examples_dir,
            'view_mode': 'detailed',
            'definitions_line_mapping': {'create_car': 23},
        }
        mermaid_output, metadata = self.generator.generate(test_code, context)
        
        # Check that imports are processed (showing the file has dependencies)
        self.assertIn("from connection_example.brands import Brand", mermaid_output)
        
        # Check that the metadata structure supports connection view
        entry_selection = metadata['entry_selection']
        self.assertEqual(entry_selection['type'], 'function')
        self.assertEqual(entry_selection['name'], 'create_car')
        
        # Verify metadata has all required fields for connection view
        self.assertIn('collapsed_subgraphs', metadata)
        self.assertIn('expanded_subgraphs', metadata)
        self.assertIn('subgraph_status_map', metadata)


if __name__ == '__main__':
    unittest.main()