"""
Test cases for different view modes: compact and detailed.
"""

import unittest
import os
import sys
from unittest.mock import patch
from pathlib import Path

# Add the parent directory to the path to import the flowchart module
parent_dir = Path(__file__).parent.parent.parent.parent
if str(parent_dir) not in sys.path:
    sys.path.insert(0, str(parent_dir))

from flowchart.main import FlowchartGenerator


class TestViewModes(unittest.TestCase):
    """Test different view modes: compact and detailed."""

    def setUp(self):
        """Set up test environment."""
        self.generator = FlowchartGenerator()
        self.examples_dir = Path(__file__).parent.parent / "examples"

    def _read_example_file(self, filename):
        """Read an example file and return its content."""
        file_path = self.examples_dir / filename
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read()

    def test_compact_view_mode(self):
        """Test that compact view mode hides verbose elements."""
        # Use a complex scenario example
        test_code = self._read_example_file('example_complex_scenario.py')
        
        with patch.dict(os.environ, {
            'FLOWCHART_VIEW': 'compact',
            'ENTRY_TYPE': 'file'
        }):
            context = {
                'file_path': 'example_complex_scenario.py',
                'entry_type': 'file',
                'entry_name': None,
                'entry_class': None,
                'workspace_root': None,
                'view_mode': 'compact',
                'definitions_line_mapping': {},
            }
            mermaid_output, metadata = self.generator.generate(test_code, context)
            
            # Compact view should hide verbose elements
            # Should NOT include: print statements, imports, exceptions, try-catch
            self.assertNotIn('print', mermaid_output.lower())
            self.assertNotIn('import', mermaid_output.lower())
            self.assertNotIn('try', mermaid_output.lower())
            self.assertNotIn('except', mermaid_output.lower())
            self.assertNotIn('raise', mermaid_output.lower())
            
            # Should still include: function calls, returns, variable assignments
            self.assertIn('Call:', mermaid_output)
            self.assertIn('return', mermaid_output)

    def test_detailed_view_mode(self):
        """Test that detailed view mode shows everything."""
        # Use a simple function example
        test_code = self._read_example_file('example_simple_function.py')
        
        with patch.dict(os.environ, {
            'FLOWCHART_VIEW': 'detailed',
            'ENTRY_TYPE': 'file'
        }):
            context = {
                'file_path': 'example_simple_function.py',
                'entry_type': 'file',
                'entry_name': None,
                'entry_class': None,
                'workspace_root': None,
                'view_mode': 'detailed',
                'definitions_line_mapping': {},
            }
            mermaid_output, metadata = self.generator.generate(test_code, context)
            
            # Detailed view should show everything (except what's filtered by post-processor)
            self.assertIn('Call:', mermaid_output)
            self.assertIn('return', mermaid_output)
            self.assertIn('assign', mermaid_output.lower())

    def test_view_mode_comparison(self):
        """Test that different view modes produce different levels of detail."""
        # Use a complex scenario example
        test_code = self._read_example_file('example_complex_scenario.py')
        
        # Test both view modes
        view_modes = ['compact', 'detailed']
        outputs = {}
        
        for view_mode in view_modes:
            with patch.dict(os.environ, {
                'FLOWCHART_VIEW': view_mode,
                'ENTRY_TYPE': 'file'
            }):
                context = {
                    'file_path': f'example_complex_scenario_{view_mode}.py',
                    'entry_type': 'file',
                    'entry_name': None,
                    'entry_class': None,
                    'workspace_root': None,
                    'view_mode': view_mode,
                    'definitions_line_mapping': {},
                }
                mermaid_output, metadata = self.generator.generate(test_code, context)
                outputs[view_mode] = mermaid_output
        
        # Detailed should be the longest
        detailed_lines = len(outputs['detailed'].split('\n'))
        compact_lines = len(outputs['compact'].split('\n'))
        
        self.assertGreater(detailed_lines, compact_lines, "Detailed view should be longer than compact")
        
        # Check specific content differences
        # Note: All view modes hide print statements in the post-processor
        # So we check for other differences instead
        detailed_content = outputs['detailed'].lower()
        compact_content = outputs['compact'].lower()
        
        # All should have calls and returns
        self.assertIn('call:', detailed_content)
        self.assertIn('call:', compact_content)
        self.assertIn('return', detailed_content)
        self.assertIn('return', compact_content)

    def test_view_mode_with_classes(self):
        """Test view modes with class-based code."""
        # Use a class method calls example
        test_code = self._read_example_file('example_class_method_calls.py')
        
        view_modes = ['compact', 'detailed']
        
        for view_mode in view_modes:
            with patch.dict(os.environ, {
                'FLOWCHART_VIEW': view_mode,
                'ENTRY_TYPE': 'file'
            }):
                context = {
                    'file_path': f'example_class_method_calls_{view_mode}.py',
                    'entry_type': 'file',
                    'entry_name': None,
                    'entry_class': None,
                    'workspace_root': None,
                    'view_mode': view_mode,
                    'definitions_line_mapping': {},
                }
                mermaid_output, metadata = self.generator.generate(test_code, context)
                
                # All views should show class and method calls
                self.assertIn('Class:', mermaid_output)
                self.assertIn('Method:', mermaid_output)
                self.assertIn('Call:', mermaid_output)
                
                # Note: All view modes hide print statements in the post-processor
                # So we just verify the basic structure is present

    def test_view_mode_with_car_production(self):
        """Test view modes with the car production workflow example."""
        # Use the car production example
        test_code = self._read_example_file('example_car_production.py')
        
        view_modes = ['compact', 'detailed']
        
        for view_mode in view_modes:
            with patch.dict(os.environ, {
                'FLOWCHART_VIEW': view_mode,
                'ENTRY_TYPE': 'file'
            }):
                context = {
                    'file_path': f'example_car_production_{view_mode}.py',
                    'entry_type': 'file',
                    'entry_name': None,
                    'entry_class': None,
                    'workspace_root': None,
                    'view_mode': view_mode,
                    'definitions_line_mapping': {},
                }
                mermaid_output, metadata = self.generator.generate(test_code, context)
                
                # All views should show class definitions and method calls
                self.assertIn('Class:', mermaid_output)
                self.assertIn('Method:', mermaid_output)
                self.assertIn('Call and Return', mermaid_output)
                
                # Note: All view modes hide print statements in the post-processor
                # So we just verify the basic structure is present


if __name__ == '__main__':
    unittest.main()