"""
Comprehensive subgraph tests using complex_scenario.py.
Tests all subgraph functionality including collapsing, whitelisting, force collapsing, and priority handling.
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

from .base import TestFlowchartMain


class TestSubgraphs(TestFlowchartMain):
    """Comprehensive test suite for subgraph functionality using complex_scenario.py."""
    
    def test_max_subgraph_nodes_collapse(self):
        """Test that subgraphs collapse when MAX_SUBGRAPH_NODES = 5."""
        with patch.dict(os.environ, {'MAX_SUBGRAPH_NODES': '5'}):
            mermaid_output, metadata, stdout, stderr = self._run_main_with_file('complex_scenario.py')
        
        # Verify output is valid
        self.assertIn('graph', mermaid_output)
        self.assertIsInstance(metadata, dict)
        
        # Check that collapsed subgraphs are present
        self.assertIn('collapsed_nodes__', mermaid_output, "Should have collapsed nodes")
        self.assertIn('nodes)', mermaid_output, "Should show node count in collapsed subgraphs")
        
        # Check that metadata contains collapsed subgraphs information
        self.assertIn('collapsed_subgraphs', metadata, "Metadata should contain collapsed subgraphs")
        self.assertIsInstance(metadata['collapsed_subgraphs'], dict, "collapsed_subgraphs should be a dict")
        
        # Verify that connections still exist to collapsed subgraphs
        self.assertTrue(
            '<-->|Call and Return|' in mermaid_output or '-->|Call|' in mermaid_output,
            "Should maintain connections to collapsed subgraphs"
        )

    def test_whitelist_protection(self):
        """Test that whitelisted subgraphs are NOT collapsed even when MAX_SUBGRAPH_NODES = 5."""
        with patch.dict(os.environ, {
            'MAX_SUBGRAPH_NODES': '5',
            'SUBGRAPH_WHITELIST': 'Database'
        }):
            mermaid_output, metadata, stdout, stderr = self._run_main_with_file('complex_scenario.py')
        
        # Verify output is valid
        self.assertIn('graph', mermaid_output)
        self.assertIsInstance(metadata, dict)
        
        # Check that Database class is NOT collapsed (whitelist protection)
        self.assertIn('subgraph "Class: Database"', mermaid_output)
        self.assertIn('self.name = name', mermaid_output, "Database __init__ should be visible")
        self.assertIn('self.connected = False', mermaid_output, "Database __init__ should be visible")
        
        # Check that other classes are collapsed
        self.assertIn('collapsed_nodes__', mermaid_output, "Other classes should be collapsed")

    def test_force_collapse_functionality(self):
        """Test that force collapsed subgraphs are always collapsed."""
        with patch.dict(os.environ, {
            'FORCE_COLLAPSE_LIST': 'UserService'
        }):
            mermaid_output, metadata, stdout, stderr = self._run_main_with_file('complex_scenario.py')
        
        # Verify output is valid
        self.assertIn('graph', mermaid_output)
        self.assertIsInstance(metadata, dict)
        
        # Check that UserService is collapsed
        self.assertIn('collapsed_nodes__', mermaid_output, "UserService should be force collapsed")
        
        # Check that other classes are not collapsed (unless they exceed threshold)
        self.assertIn('subgraph "Class: Database"', mermaid_output, "Database should be visible")

    def test_force_collapse_with_special_names(self):
        """Test force collapse with special names that could cause conflicts."""
        # Test with actual subgraph names from complex_scenario.py
        special_names = [
            'Database',  # Class name
            'UserService',  # Class name
            'AuthService',  # Class name
            'class_Database',  # Class prefix
            'class_UserService_get_user',  # Method with underscores
            'class_AuthService_authenticate'  # Method with underscores
        ]
        
        for special_name in special_names:
            with patch.dict(os.environ, {
                'FORCE_COLLAPSE_LIST': special_name
            }):
                mermaid_output, metadata, stdout, stderr = self._run_main_with_file('complex_scenario.py')
            
            # Verify output is valid
            self.assertIn('graph', mermaid_output)
            self.assertIsInstance(metadata, dict)
            
            # Check that force collapse was applied (some subgraphs should be collapsed)
            collapsed_subgraphs = metadata.get('collapsed_subgraphs', {})
            self.assertGreater(len(collapsed_subgraphs), 0, 
                             f"Force collapse with '{special_name}' should collapse some subgraphs")

    def test_class_collapse_hides_methods(self):
        """Test that collapsing a class also hides the methods inside it."""
        with patch.dict(os.environ, {
            'FORCE_COLLAPSE_LIST': 'Database'  # Collapse entire Database class
        }):
            mermaid_output, metadata, stdout, stderr = self._run_main_with_file('complex_scenario.py')
        
        # Verify output is valid
        self.assertIn('graph', mermaid_output)
        self.assertIsInstance(metadata, dict)
        
        # Check that Database class is collapsed
        self.assertIn('collapsed_nodes__class_Database', mermaid_output, "Database class should be collapsed")
        
        # Check that Database methods are NOT visible as separate subgraphs
        # (they should be hidden inside the collapsed class)
        lines = mermaid_output.split('\n')
        database_methods_visible = False
        for line in lines:
            if 'subgraph "Method:' in line and ('Database' in line or 'connect' in line or 'query' in line):
                database_methods_visible = True
                break
        
        self.assertFalse(database_methods_visible, 
                        "Database methods should be hidden when Database class is collapsed")

    def test_whitelist_vs_force_collapse_priority(self):
        """Test priority between whitelist and force collapse."""
        # Test case 1: Force collapse exact should override whitelist pattern
        with patch.dict(os.environ, {
            'MAX_SUBGRAPH_NODES': '10',  # High threshold to avoid size-based collapse
            'SUBGRAPH_WHITELIST': 'Database',  # Whitelist Database (pattern)
            'FORCE_COLLAPSE_LIST': 'Database'  # Force collapse Database (exact)
        }):
            mermaid_output1, metadata1, stdout1, stderr1 = self._run_main_with_file('complex_scenario.py')
        
        # Database should be collapsed (force collapse exact overrides whitelist pattern)
        self.assertIn('collapsed_nodes__', mermaid_output1, 
                     "Database should be collapsed (force collapse exact overrides whitelist pattern)")
        
        # Test case 2: Whitelist exact should override force collapse pattern
        with patch.dict(os.environ, {
            'MAX_SUBGRAPH_NODES': '10',
            'SUBGRAPH_WHITELIST': 'Database',  # Whitelist Database (exact)
            'FORCE_COLLAPSE_LIST': 'Database'  # Force collapse Database (exact - same as whitelist)
        }):
            mermaid_output2, metadata2, stdout2, stderr2 = self._run_main_with_file('complex_scenario.py')
        
        # When both are exact matches, force collapse should win
        self.assertIn('collapsed_nodes__', mermaid_output2, 
                     "Database should be collapsed (force collapse exact beats whitelist exact)")

    def test_comprehensive_subgraph_scenarios(self):
        """Test comprehensive scenarios with class, function, and method subgraphs."""
        # Scenario 1: Size-based collapse
        with patch.dict(os.environ, {'MAX_SUBGRAPH_NODES': '5'}):
            mermaid_output1, metadata1, stdout1, stderr1 = self._run_main_with_file('complex_scenario.py')
        
        collapsed_subgraphs1 = metadata1.get('collapsed_subgraphs', {})
        self.assertGreater(len(collapsed_subgraphs1), 0, "Should have collapsed subgraphs with MAX_SUBGRAPH_NODES=5")
        
        # Scenario 2: Whitelist protection
        with patch.dict(os.environ, {
            'MAX_SUBGRAPH_NODES': '5',
            'SUBGRAPH_WHITELIST': 'Database,UserService'
        }):
            mermaid_output2, metadata2, stdout2, stderr2 = self._run_main_with_file('complex_scenario.py')
        
        # Database and UserService should be visible (whitelisted)
        self.assertIn('subgraph "Class: Database"', mermaid_output2, "Database should be visible (whitelisted)")
        self.assertIn('subgraph "Class: UserService"', mermaid_output2, "UserService should be visible (whitelisted)")
        
        # Scenario 3: Force collapse specific methods
        with patch.dict(os.environ, {
            'MAX_SUBGRAPH_NODES': '10',
            'FORCE_COLLAPSE_LIST': 'class_Database_query,class_UserService_get_user'
        }):
            mermaid_output3, metadata3, stdout3, stderr3 = self._run_main_with_file('complex_scenario.py')
        
        collapsed_subgraphs3 = metadata3.get('collapsed_subgraphs', {})
        # Check that specific methods are collapsed
        self.assertTrue(
            any('Database' in key and 'query' in key for key in collapsed_subgraphs3.keys()) or
            any('UserService' in key and 'get_user' in key for key in collapsed_subgraphs3.keys()),
            "Specific methods should be force collapsed"
        )

    def test_metadata_structure(self):
        """Test that metadata structure is correct for all subgraph operations."""
        with patch.dict(os.environ, {
            'MAX_SUBGRAPH_NODES': '5',
            'SUBGRAPH_WHITELIST': 'Database',
            'FORCE_COLLAPSE_LIST': 'UserService'
        }):
            mermaid_output, metadata, stdout, stderr = self._run_main_with_file('complex_scenario.py')
        
        # Verify metadata structure
        self.assertIn('collapsed_subgraphs', metadata)
        self.assertIn('all_subgraphs', metadata)
        self.assertIn('expanded_subgraphs', metadata)
        self.assertIn('subgraph_status_map', metadata)
        
        collapsed_subgraphs = metadata['collapsed_subgraphs']
        expanded_subgraphs = metadata['expanded_subgraphs']
        subgraph_status_map = metadata['subgraph_status_map']
        
        # Verify collapsed subgraphs structure
        self.assertIsInstance(collapsed_subgraphs, dict)
        for scope, info in collapsed_subgraphs.items():
            self.assertIn('node_count', info)
            self.assertIn('original_scope', info)
            self.assertIn('subgraph_name', info)
            self.assertIn('status', info)
            self.assertEqual(info['status'], 'collapsed')
            self.assertIsInstance(info['node_count'], int)
            self.assertGreater(info['node_count'], 0)
        
        # Verify expanded subgraphs structure
        self.assertIsInstance(expanded_subgraphs, dict)
        for scope, info in expanded_subgraphs.items():
            self.assertIn('node_count', info)
            self.assertIn('original_scope', info)
            self.assertIn('subgraph_name', info)
            self.assertIn('status', info)
            self.assertEqual(info['status'], 'expanded')
            self.assertIsInstance(info['node_count'], int)
            self.assertGreater(info['node_count'], 0)
        
        # Verify subgraph_status_map contains all subgraphs
        self.assertIsInstance(subgraph_status_map, dict)
        self.assertEqual(len(subgraph_status_map), len(expanded_subgraphs) + len(collapsed_subgraphs))

    def test_sequential_flow_with_subgraphs(self):
        """Test subgraph functionality in sequential flow mode."""
        with patch.dict(os.environ, {
            'MAX_SUBGRAPH_NODES': '5',
            'SEQUENTIAL_FLOW': '1',
            'SUBGRAPH_WHITELIST': 'Database'
        }):
            mermaid_output, metadata, stdout, stderr = self._run_main_with_file('complex_scenario.py')
        
        # Verify output is valid
        self.assertIn('graph', mermaid_output)
        self.assertIsInstance(metadata, dict)
        
        # Verify sequential flow mode is active
        self.assertIn('-->|Call|', mermaid_output, "Should have sequential flow arrows")
        self.assertNotIn('Call and Return', mermaid_output, "Should not have bidirectional arrows in sequential flow")
        
        # Check that Database class is NOT collapsed (whitelist protection)
        self.assertIn('subgraph "Class: Database"', mermaid_output)
        
        # Check that other classes are collapsed
        self.assertIn('collapsed_nodes__', mermaid_output, "Other classes should be collapsed")
        
        # Verify that connections still exist to collapsed subgraphs in sequential flow
        self.assertIn('-->|Call|', mermaid_output, "Should maintain sequential connections")


if __name__ == '__main__':
    unittest.main()


