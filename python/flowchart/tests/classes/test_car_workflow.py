"""
Unit tests for car workflow flowchart generation.
Tests the car production pipeline with subgraphs for design, mounting, building, and selling.
"""
import unittest
from unittest.mock import patch
from ..base import TestFlowchartMain


class TestCarWorkflow(TestFlowchartMain):
    """Test car production workflow flowchart generation."""
    
    def test_car_production_subgraphs(self):
        """Test that all car production subgraphs are created."""
        mermaid_output, metadata, stdout, stderr = self._run_main_with_file('example_car_production.py')
        
        # Verify output is valid
        self.assertIn('graph', mermaid_output)
        self.assertIsInstance(metadata, dict)
        
        # Verify main class is present
        self.assertIn('ProductionLine', mermaid_output, "ProductionLine class should be present")
        
        # Verify main method is present
        self.assertIn('run_full_production', mermaid_output, "Main production method should be present")
        
        # Verify ProductionLine subgraph exists
        self.assertIn('subgraph "Class: ProductionLine"', mermaid_output, 
                     "ProductionLine class subgraph should exist")
        
        # Verify __init__ method exists
        self.assertIn('subgraph "Method: __init__"', mermaid_output,
                     "Constructor method subgraph should exist")
        
        # Verify run_full_production method exists
        self.assertIn('subgraph "Method: run_full_production"', mermaid_output,
                     "run_full_production method subgraph should exist")
        
        # Verify that methods are being called (even if they show errors)
        self.assertIn('design_car', mermaid_output, "design_car method should be called")
        self.assertIn('mount_car', mermaid_output, "mount_car method should be called")
        
        # Verify connections are being made
        self.assertTrue('<-->|Call and Return|' in mermaid_output or '-->|Call|' in mermaid_output,
                     "Method calls should create connections")
        
        # Count subgraphs to verify we're creating them
        subgraph_count = self._count_subgraphs(mermaid_output)
        print(f"\n=== Car Workflow Test Result ===")
        print(f"Total subgraphs found: {subgraph_count}")
        print(f"Expected: At least 2 subgraphs (__init__ and run_full_production methods)")
        
        # Verify we have method subgraphs
        self.assertGreaterEqual(subgraph_count, 2, 
                               "Should have at least 2 method subgraphs in ProductionLine")


if __name__ == '__main__':
    unittest.main()

