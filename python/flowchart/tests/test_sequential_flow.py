"""
Unit tests for sequential flow mode.
Tests that SEQUENTIAL_FLOW mode generates one-way arrows instead of bidirectional Call and Return.
"""
import os
import unittest
from unittest.mock import patch
from .base import TestFlowchartMain


class TestSequentialFlow(TestFlowchartMain):
    """Test sequential flow mode generation."""
    
    def test_sequential_flow_disabled(self):
        """Test that traditional Call and Return mode still works."""
        with patch.dict(os.environ, {
            'SEQUENTIAL_FLOW': '0'
        }):
            mermaid_output, metadata, stdout, stderr = self._run_main_with_file('test_sequential.py')
            
        # Verify Call and Return is present
        self.assertIn('Call and Return', mermaid_output,
                     "Traditional mode should use 'Call and Return' label")
        
        # Verify bidirectional arrows exist
        self.assertIn('<-->|', mermaid_output,
                     "Traditional mode should use bidirectional arrows")
    
    def test_sequential_flow_enabled(self):
        """Test that sequential flow mode uses one-way arrows."""
        with patch.dict(os.environ, {
            'SEQUENTIAL_FLOW': '1'
        }):
            mermaid_output, metadata, stdout, stderr = self._run_main_with_file('test_sequential.py')
            
        # Verify Call and Return is NOT present
        self.assertNotIn('Call and Return', mermaid_output,
                         "Sequential mode should not use 'Call and Return' label")
        
        # Verify one-way Call arrows exist
        self.assertIn('-->|Call|', mermaid_output,
                     "Sequential mode should use one-way arrows")
        
        # Verify bidirectional arrows do NOT exist
        self.assertNotIn('<-->|', mermaid_output,
                         "Sequential mode should not use bidirectional arrows")
        
        print(f"\n=== Sequential Flow Test Result ===")
        print(f"Sequential flow: {'SEQUENTIAL_FLOW' in mermaid_output or 'Call' in mermaid_output}")


if __name__ == '__main__':
    unittest.main()

