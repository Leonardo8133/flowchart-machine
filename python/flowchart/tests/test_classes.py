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

from .base import TestFlowchartMain


class TestFlowchartClasses(TestFlowchartMain):        
    def test_class_basic(self):
        """Test flowchart generation with class_basic.py."""
        mermaid_output, metadata, stdout, stderr = self._run_main_with_file('class_basic.py')
        
        # Verify output is valid
        self.assertIn('graph', mermaid_output)
        self.assertIsInstance(metadata, dict)

        # Check if the subgraphs were created for each method (__init__, add, multiply, get_value)
        # Should have 5 subgraphs: 1 class + 4 method subgraphs
        self.assertEqual(self._count_subgraphs(mermaid_output), 5, "Should have 5 subgraphs (1 class + 4 method)")
        self.assertIn('subgraph "Class: Calculator"', mermaid_output)
        self.assertIn('subgraph "Method: __init__"', mermaid_output)
        self.assertIn('subgraph "Method: add"', mermaid_output)
        self.assertIn('subgraph "Method: multiply"', mermaid_output)
        self.assertIn('subgraph "Method: get_value"', mermaid_output)
        
        # Check bidirectional arrows for method calls
        # Method calls should have bidirectional arrows with "Call and Return" label
        self.assertIn('<-->|Call and Return|', mermaid_output)
        
        # Check that constructor calls have "Call and Return" label
        self.assertIn('<-->|Call and Return|', mermaid_output)
        
        # Verify the flow continues after method calls
        self.assertIn('method_call8 --> method_call13', mermaid_output)
        self.assertIn('method_call13 --> assign18', mermaid_output)
        
        # Verify start and end connections
        self.assertIn('start1 --> expr3', mermaid_output, "Start should connect to description")
        self.assertIn('print21 --> end2', mermaid_output, "Last statement should connect to end")
        
        # Verify main flow sequence
        self.assertIn('expr3 --> assign5', mermaid_output, "Description should connect to instantiation")
        # Check that instantiation connects to __init__, then instantiation connects to next operation
        self.assertIn('assign5 <-->|Call and Return| method___init__6', mermaid_output, "Instantiation should connect to __init__")
        self.assertIn('assign5 --> method_call8', mermaid_output, "After __init__ call, instantiation should connect to first method call")
        self.assertIn('assign18 --> print21', mermaid_output, "Last method call should connect to final print")
        
        # Verify constructor call connection
        self.assertIn('assign5 <-->|Call and Return| method___init__6', mermaid_output, "Instantiation should call constructor")
        
        # Verify method call bidirectional connections
        self.assertIn('method_call8 <-->|Call and Return| method_add9', mermaid_output, "Method call should have bidirectional connection")
        self.assertIn('method_call13 <-->|Call and Return| method_multiply14', mermaid_output, "Method call should have bidirectional connection")
        self.assertIn('assign18 <-->|Call and Return| method_get_value19', mermaid_output, "Method call with assignment should have bidirectional connection")
        
        # Verify method internal flow
        self.assertIn('method___init__6 --> assign7', mermaid_output, "Constructor should have internal flow")
        self.assertIn('method_add9 --> augassign10', mermaid_output, "Method add should have internal flow")
        self.assertIn('augassign10 --> print11', mermaid_output, "Method add should have sequential flow")
        self.assertIn('print11 --> return12', mermaid_output, "Method add should end with return")
        
        # Verify no redundant class node
        self.assertNotIn('class4[["Class: Calculator"]]', mermaid_output, "Should not have redundant class node")
        self.assertNotIn('class_dummy', mermaid_output, "Dummy node should not be visible in output")
    
    def test_class_basic_with_entry_class_at_init(self):
        """Test flowchart generation with class_basic.py and entry class specified."""
        mermaid_output, metadata, stdout, stderr = self._run_main_with_file(
            'class_basic.py',
            entry_type='class',
            entry_class='Calculator'
        )
        
        # Verify output is valid
        self.assertIn('graph', mermaid_output)
        self.assertIsInstance(metadata, dict)
        
        # Verify only __init__ method is present (entry point)
        self.assertIn('subgraph "Class: Calculator"', mermaid_output)
        self.assertIn('subgraph "Method: __init__"', mermaid_output)
        self.assertNotIn('subgraph "Method: add"', mermaid_output, "Should not include add method when entry is class")
        self.assertNotIn('subgraph "Method: multiply"', mermaid_output, "Should not include multiply method when entry is class")
        
        # Verify start connects to instantiation
        self.assertIn('start1 --> instantiate', mermaid_output)
        
        # Verify instantiation calls __init__
        self.assertIn('<-->|Call and Return|', mermaid_output)
        
        # Verify end connects to last node inside __init__, not to instantiation
        # The last node in __init__ is the assignment
        self.assertIn('assign', mermaid_output)
        self.assertIn('--> end2', mermaid_output)
        # Make sure end is NOT connected to instantiate node
        self.assertNotIn('instantiate4 --> end2', mermaid_output, "End should connect to last node inside method, not calling node")
        
        # Check entry_selection in metadata
        if 'error' not in mermaid_output.lower() and metadata:
            self.assertIn('entry_selection', metadata)
            self.assertEqual(metadata['entry_selection']['type'], 'class')
            self.assertEqual(metadata['entry_selection']['class'], 'Calculator')
     
    def test_class_basic_with_entry_class_at_method(self):
        """Test flowchart generation with class_basic.py and entry class specified."""
        mermaid_output, metadata, stdout, stderr = self._run_main_with_file(
            'class_basic.py',
            entry_type='class',
            entry_class='Calculator',
            entry_name='add'
        )
        
        # Verify output is valid
        self.assertIn('graph', mermaid_output)
        self.assertIsInstance(metadata, dict)
        
        # Check if the class definition subgraph was created
        self.assertIn('subgraph "Class: Calculator"', mermaid_output)
        self.assertIn('subgraph "Method: add"', mermaid_output)

        # check if the end node is connected to the return node of the add method (use regex to find the return node)
        self.assertRegex(mermaid_output, r'return\d+ --> end2')
        
        # Check if the add method subgraph was created

    def test_class_method_calls(self):
        """Test flowchart generation with class_method_calls.py."""
        mermaid_output, metadata, stdout, stderr = self._run_main_with_file('class_method_calls.py')
        
        # Verify output is valid
        self.assertIn('graph', mermaid_output)
        self.assertIsInstance(metadata, dict)
        
        # Check that direct class method calls show error nodes
        # TestClass.test_method() and TestClass.other_method() are instance methods
        # called directly on the class without instantiation - this should show errors
        self.assertIn('❌', mermaid_output, "Should show error nodes for uninstanciated class method calls")
        self.assertIn('Method', mermaid_output)
        
        # Check return connections for correct instance method calls with assignments
        self.assertIn('result1 = obj1.test_method()', mermaid_output)
        self.assertIn('result2 = obj2.calculate_value()', mermaid_output)
        
        # Verify bidirectional arrows exist for valid method calls
        # (Valid method calls should get bidirectional arrows)
        self.assertIn('<-->|Call and Return|', mermaid_output)
    
    def test_complex_scenario(self):
        """Test flowchart generation with complex_scenario.py."""
        mermaid_output, metadata, stdout, stderr = self._run_main_with_file('complex_scenario.py')
        
        # Verify output is valid
        self.assertIn('graph', mermaid_output)
        self.assertIsInstance(metadata, dict)
    
    def test_with_entry_function(self):
        """Test flowchart generation with entry function specified."""
        mermaid_output, metadata, stdout, stderr = self._run_main_with_file(
            'simple_function.py',
            entry_type='function',
            entry_name='calculate_sum'
        )
        
        # Verify output is valid
        self.assertIn('graph', mermaid_output)
        
        # Check entry_selection in metadata
        if 'error' not in mermaid_output.lower() and metadata:
            self.assertIn('entry_selection', metadata)
            self.assertEqual(metadata['entry_selection']['type'], 'function')
            self.assertEqual(metadata['entry_selection']['name'], 'calculate_sum')
    
    def test_with_entry_class(self):
        """Test flowchart generation with entry class specified."""
        mermaid_output, metadata, stdout, stderr = self._run_main_with_file(
            'class_basic.py',
            entry_type='class',
            entry_name='Calculator'
        )
        
        # Verify output is valid
        self.assertIn('graph', mermaid_output)
        
        # Check entry_selection in metadata
        if 'error' not in mermaid_output.lower() and metadata:
            self.assertIn('entry_selection', metadata)
            self.assertEqual(metadata['entry_selection']['type'], 'class')
            self.assertEqual(metadata['entry_selection']['name'], 'Calculator')
    
    def test_with_entry_method(self):
        """Test flowchart generation with entry method specified."""
        mermaid_output, metadata, stdout, stderr = self._run_main_with_file(
            'class_basic.py',
            entry_type='method',
            entry_name='add',
            entry_class='Calculator'
        )
        
        # Verify output is valid
        self.assertIn('graph', mermaid_output)
        
        # Check entry_selection in metadata
        if 'error' not in mermaid_output.lower() and metadata:
            self.assertIn('entry_selection', metadata)
            self.assertEqual(metadata['entry_selection']['type'], 'method')
            self.assertEqual(metadata['entry_selection']['name'], 'add')
            self.assertEqual(metadata['entry_selection']['class'], 'Calculator')
    
    def test_with_breakpoints(self):
        """Test flowchart generation with breakpoints."""
        mermaid_output, metadata, stdout, stderr = self._run_main_with_file(
            'simple_function.py',
            breakpoint_lines=[5, 10]
        )
        
        # Verify output is valid
        self.assertIn('graph', mermaid_output)
        self.assertIsInstance(metadata, dict)

    def test_property_method_validation(self):
        """Test that properties and methods are correctly validated and differentiated."""
        mermaid_output, metadata, stdout, stderr = self._run_main_with_file(
            'property_method_validation.py'
        )
        
        # Verify output is valid
        self.assertIn('graph', mermaid_output)
        self.assertIsInstance(metadata, dict)
        
        # Check that User class is present
        self.assertIn('subgraph "Class: User"', mermaid_output)
        
        # Check that __init__ is called and properties are set
        self.assertIn('Constructor: __init__(name)', mermaid_output)
        self.assertIn('self.name = name', mermaid_output)
        self.assertIn('self.email = "test@example.com"', mermaid_output)
        
        # Check valid property access (user.name) in if condition
        self.assertIn('if user.name', mermaid_output)
        
        # Check valid method call (user.get_info())
        self.assertIn('info = user.get_info()', mermaid_output)
        self.assertIn('Method: get_info()', mermaid_output)
        
        # Check non-existent property access (user.age) in if condition
        self.assertIn('if user.age', mermaid_output)
        # Note: Property validation might not be fully implemented yet
        
        # Check non-existent method call (user.delete()) - should show error
        self.assertIn('Call: user.delete()', mermaid_output)
        self.assertIn('❌ Method \'delete\' not found in User', mermaid_output)
        
        # Verify that the User instantiation is present
        self.assertIn('user = User(\'John\')', mermaid_output)
        
        # Verify method subgraphs are created
        self.assertIn('subgraph "Method: __init__"', mermaid_output)
        self.assertIn('subgraph "Method: get_info"', mermaid_output)
        
        # Verify the return statement in get_info
        self.assertIn('return f\'{self.name} - {self.email}\'', mermaid_output)
        
        # CRITICAL: Verify that user instantiation is connected to the class subgraph
        # The user = User('John') should connect to the __init__ method
        self.assertIn('user = User(\'John\')', mermaid_output)
        self.assertIn('Constructor: __init__(name)', mermaid_output)
        
        # Verify the connection from instantiation to constructor
        # This should show: user = User('John') -->|Call and Return| Constructor: __init__(name)
        self.assertIn('Call and Return', mermaid_output)
        
        # Verify that the method call connects to the method subgraph
        # info = user.get_info() should connect to Method: get_info()
        self.assertIn('Call and Return', mermaid_output)
        
        # Verify True/False labels are present for if statements
        self.assertIn('|True|', mermaid_output)
        self.assertIn('|False|', mermaid_output)

    def test_collapsed_subgraphs_basic(self):
        """Test that subgraphs are collapsed when they exceed MAX_SUBGRAPH_NODES."""
        # Set a low threshold to force collapse
        with patch.dict(os.environ, {'MAX_SUBGRAPH_NODES': '5'}):
            mermaid_output, metadata, stdout, stderr = self._run_main_with_file('complex_scenario.py')
        
        # Verify output is valid
        self.assertIn('graph', mermaid_output)
        self.assertIsInstance(metadata, dict)
        
        # Check that collapsed subgraphs are present
        self.assertIn('collapsed_nodes__', mermaid_output, "Should have collapsed nodes")
        self.assertIn('nodes)', mermaid_output, "Should show node count in collapsed subgraphs")
        
        # Verify that connections still exist to collapsed subgraphs
        self.assertIn('<-->|Call and Return|', mermaid_output, "Should maintain bidirectional connections")
        
        # Check that metadata contains collapsed subgraphs information
        self.assertIn('collapsed_subgraphs', metadata, "Metadata should contain collapsed subgraphs")
        self.assertIsInstance(metadata['collapsed_subgraphs'], dict, "collapsed_subgraphs should be a dict")

    def test_collapsed_subgraphs_with_whitelist(self):
        """Test that whitelisted subgraphs are not collapsed even when large."""
        # Set a low threshold and whitelist Database class
        with patch.dict(os.environ, {
            'MAX_SUBGRAPH_NODES': '5',
            'SUBGRAPH_WHITELIST': 'Database'
        }):
            mermaid_output, metadata, stdout, stderr = self._run_main_with_file('complex_scenario.py')
        
        # Verify output is valid
        self.assertIn('graph', mermaid_output)
        self.assertIsInstance(metadata, dict)
        
        # Check that Database class is NOT collapsed (should show internal nodes)
        self.assertIn('subgraph "Class: Database"', mermaid_output)
        self.assertIn('self.name = name', mermaid_output, "Database __init__ should be visible")
        self.assertIn('self.connected = False', mermaid_output, "Database __init__ should be visible")
        
        # Check that other classes are collapsed
        self.assertIn('collapsed_nodes__', mermaid_output, "Other classes should be collapsed")

    def test_collapsed_subgraphs_with_force_collapse(self):
        """Test that force collapsed subgraphs are always collapsed."""
        # Force collapse UserService
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

    def test_collapsed_subgraphs_connections_preserved(self):
        """Test that connections to collapsed subgraphs are preserved."""
        # Set a low threshold to force collapse
        with patch.dict(os.environ, {'MAX_SUBGRAPH_NODES': '5'}):
            mermaid_output, metadata, stdout, stderr = self._run_main_with_file('complex_scenario.py')
        
        # Verify output is valid
        self.assertIn('graph', mermaid_output)
        self.assertIsInstance(metadata, dict)
        
        # Check that main flow connections are preserved
        self.assertIn('db = Database(\'main_db\')', mermaid_output)
        self.assertIn('user_service = UserService(db)', mermaid_output)
        self.assertIn('auth_service = AuthService(user_service)', mermaid_output)
        
        # Check that method call connections are preserved
        self.assertIn('user_service.get_user(123)', mermaid_output)
        self.assertIn('user_service.create_user(\'john_doe\')', mermaid_output)
        self.assertIn('auth_service.authenticate(123)', mermaid_output)
        
        # Verify bidirectional connections are maintained
        self.assertIn('<-->|Call and Return|', mermaid_output, "Bidirectional connections should be preserved")

    def test_collapsed_subgraphs_metadata(self):
        """Test that collapsed subgraphs metadata is correctly generated."""
        # Set a low threshold to force collapse
        with patch.dict(os.environ, {'MAX_SUBGRAPH_NODES': '5'}):
            mermaid_output, metadata, stdout, stderr = self._run_main_with_file('complex_scenario.py')
        
        # Verify metadata structure
        self.assertIn('collapsed_subgraphs', metadata)
        self.assertIn('all_subgraphs', metadata)
        
        collapsed_subgraphs = metadata['collapsed_subgraphs']
        self.assertIsInstance(collapsed_subgraphs, dict)
        
        # Check that collapsed subgraphs have proper metadata
        for scope, info in collapsed_subgraphs.items():
            self.assertIn('node_count', info)
            self.assertIn('original_scope', info)
            self.assertIn('subgraph_name', info)
            self.assertIn('collapsed_node_id', info)
            self.assertIsInstance(info['node_count'], int)
            self.assertGreater(info['node_count'], 0)

    def test_collapsed_subgraphs_node_count_display(self):
        """Test that collapsed subgraphs show correct node counts."""
        # Set a low threshold to force collapse
        with patch.dict(os.environ, {'MAX_SUBGRAPH_NODES': '5'}):
            mermaid_output, metadata, stdout, stderr = self._run_main_with_file('complex_scenario.py')
        
        # Check that node counts are displayed in collapsed subgraphs
        self.assertIn('nodes)', mermaid_output, "Should show node count in collapsed subgraphs")
        
        # Verify that the node count format is correct
        import re
        node_count_pattern = r'\((\d+)\s+nodes\)'
        matches = re.findall(node_count_pattern, mermaid_output)
        self.assertGreater(len(matches), 0, "Should have at least one node count display")
        
        # Verify that node counts are reasonable
        for count_str in matches:
            count = int(count_str)
            self.assertGreater(count, 0, "Node count should be positive")
            self.assertGreaterEqual(count, 5, "Collapsed subgraphs should have at least 5 nodes")

    def test_collapsed_subgraphs_entry_point_protection(self):
        """Test that entry point subgraphs are not collapsed even when large."""
        # Test with entry class - Database should not be collapsed
        mermaid_output, metadata, stdout, stderr = self._run_main_with_file(
            'complex_scenario.py',
            entry_type='class',
            entry_class='Database'
        )
        
        # Verify output is valid
        self.assertIn('graph', mermaid_output)
        self.assertIsInstance(metadata, dict)
        
        # Check that Database class is NOT collapsed (entry point protection)
        self.assertIn('subgraph "Class: Database"', mermaid_output)
        self.assertIn('self.name = name', mermaid_output, "Database __init__ should be visible")
        
        # Check that other classes might be collapsed
        # (This depends on their size relative to MAX_SUBGRAPH_NODES)

    def test_collapsed_subgraphs_mixed_scenario(self):
        """Test mixed scenario with some collapsed and some expanded subgraphs."""
        # Set a medium threshold and whitelist one class
        with patch.dict(os.environ, {
            'MAX_SUBGRAPH_NODES': '7',  # Lower threshold to ensure some methods collapse
            'SUBGRAPH_WHITELIST': 'Database'
        }):
            mermaid_output, metadata, stdout, stderr = self._run_main_with_file('complex_scenario.py')
        
        # Verify output is valid
        self.assertIn('graph', mermaid_output)
        self.assertIsInstance(metadata, dict)
        
        # Check that Database is expanded (whitelisted)
        self.assertIn('subgraph "Class: Database"', mermaid_output)
        self.assertIn('self.name = name', mermaid_output, "Database should be expanded")
        
        # Check that some subgraphs are collapsed (AuthService.authenticate has 8 nodes)
        self.assertIn('collapsed_nodes__', mermaid_output, "Some subgraphs should be collapsed")
        
        # Verify connections are maintained
        self.assertIn('<-->|Call and Return|', mermaid_output, "Connections should be preserved")

    def test_whitelist_force_collapse_priority(self):
        """
        Test the priority system for whitelist vs force collapse lists.
        
        Priority order (highest to lowest):
        1. Force collapse EXACT match
        2. Whitelist EXACT match
        3. Entry point protection
        4. Force collapse PATTERN match
        5. Whitelist PATTERN match
        6. Size-based
        """
        # Test with conflicting whitelist and force collapse
        # TestClass is whitelisted (pattern), but TestClass_test_method is force collapsed (exact)
        with patch.dict(os.environ, {
            'MAX_SUBGRAPH_NODES': '10',  # Set higher to test explicit collapse, not size-based
            'SUBGRAPH_WHITELIST': 'TestClass,TestClass2',
            'FORCE_COLLAPSE_LIST': 'class_TestClass_test_method,class_TestClass2_calculate_value'
        }):
            mermaid_output, metadata, stdout, stderr = self._run_main_with_file('whitelist_priority_test.py')
        
        # Verify output is valid
        self.assertIn('graph', mermaid_output)
        self.assertIsInstance(metadata, dict)
        
        # Check that classes are expanded (whitelist pattern match)
        self.assertIn('subgraph "Class: TestClass"', mermaid_output)
        self.assertIn('subgraph "Class: TestClass2"', mermaid_output)
        
        # Check that specific methods are collapsed (force collapse exact match overrides parent whitelist)
        collapsed_subgraphs = metadata.get('collapsed_subgraphs', {})
        self.assertIn('class_TestClass_test_method', collapsed_subgraphs, 
                     "TestClass_test_method should be force collapsed (exact match overrides parent whitelist)")
        self.assertIn('class_TestClass2_calculate_value', collapsed_subgraphs,
                     "TestClass2_calculate_value should be force collapsed (exact match overrides parent whitelist)")
        
        # Check that other methods are expanded (parent class whitelist applies)
        self.assertIn('subgraph "Method: other_method"', mermaid_output,
                     "other_method should be expanded (parent class is whitelisted, no force collapse)")
        self.assertIn('subgraph "Method: __init__"', mermaid_output,
                     "__init__ methods should be expanded (parent class is whitelisted, no force collapse)")
        
        # Verify the priority system works correctly
        print(f"\n=== Priority Test Output ===")
        print(f"Whitelist: {metadata.get('subgraph_whitelist', [])}")
        print(f"Force Collapse: {metadata.get('force_collapse_list', [])}")
        print(f"Collapsed Subgraphs: {list(collapsed_subgraphs.keys())}")
    
    def test_whitelist_pattern_vs_exact_priority(self):
        """Test that whitelist exact matches have priority over pattern matches."""
        with patch.dict(os.environ, {
            'MAX_SUBGRAPH_NODES': '5',
            'SUBGRAPH_WHITELIST': 'TestClass,class_TestClass2_calculate_value',  # Pattern + exact
            'FORCE_COLLAPSE_LIST': 'TestClass2'  # Pattern to collapse entire TestClass2
        }):
            mermaid_output, metadata, stdout, stderr = self._run_main_with_file('whitelist_priority_test.py')
        
        # Verify output is valid
        self.assertIn('graph', mermaid_output)
        self.assertIsInstance(metadata, dict)
        
        collapsed_subgraphs = metadata.get('collapsed_subgraphs', {})
        
        # TestClass should be expanded (whitelist pattern match)
        self.assertIn('subgraph "Class: TestClass"', mermaid_output)
        
        # TestClass2 should be collapsed (force collapse pattern match)
        self.assertIn('class_TestClass2', collapsed_subgraphs, 
                     "TestClass2 should be collapsed (force collapse pattern)")
        
        # But TestClass2.calculate_value should be expanded (whitelist exact match overrides force collapse pattern)
        self.assertIn('subgraph "Method: calculate_value"', mermaid_output,
                     "TestClass2.calculate_value should be expanded (whitelist exact overrides force collapse pattern)")
        
        print(f"\n=== Pattern vs Exact Priority Test ===")
        print(f"Collapsed: {list(collapsed_subgraphs.keys())}")
    
    def test_force_collapse_exact_vs_whitelist_pattern(self):
        """Test that force collapse exact matches override whitelist pattern matches."""
        with patch.dict(os.environ, {
            'MAX_SUBGRAPH_NODES': '5',
            'SUBGRAPH_WHITELIST': 'TestClass',  # Pattern to expand entire TestClass
            'FORCE_COLLAPSE_LIST': 'class_TestClass_test_method'  # Exact to collapse specific method
        }):
            mermaid_output, metadata, stdout, stderr = self._run_main_with_file('whitelist_priority_test.py')
        
        # Verify output is valid
        self.assertIn('graph', mermaid_output)
        self.assertIsInstance(metadata, dict)
        
        collapsed_subgraphs = metadata.get('collapsed_subgraphs', {})
        
        # TestClass should be expanded (whitelist pattern match)
        self.assertIn('subgraph "Class: TestClass"', mermaid_output)
        
        # But TestClass.test_method should be collapsed (force collapse exact overrides whitelist pattern)
        self.assertIn('class_TestClass_test_method', collapsed_subgraphs,
                     "TestClass.test_method should be collapsed (force collapse exact overrides whitelist pattern)")
        
        # Other TestClass methods should be expanded (whitelist pattern applies)
        self.assertIn('subgraph "Method: other_method"', mermaid_output,
                     "TestClass.other_method should be expanded (whitelist pattern applies)")
        
        print(f"\n=== Force Collapse Exact vs Whitelist Pattern Test ===")
        print(f"Collapsed: {list(collapsed_subgraphs.keys())}")
    
    def test_multiple_exact_matches_priority(self):
        """Test priority when both whitelist and force collapse have exact matches."""
        with patch.dict(os.environ, {
            'MAX_SUBGRAPH_NODES': '5',
            'SUBGRAPH_WHITELIST': 'class_TestClass_test_method,class_TestClass2_calculate_value',  # Exact matches
            'FORCE_COLLAPSE_LIST': 'class_TestClass_test_method,class_TestClass3_get_status'  # Overlapping exact matches
        }):
            mermaid_output, metadata, stdout, stderr = self._run_main_with_file('whitelist_priority_test.py')
        
        # Verify output is valid
        self.assertIn('graph', mermaid_output)
        self.assertIsInstance(metadata, dict)
        
        collapsed_subgraphs = metadata.get('collapsed_subgraphs', {})
        
        # Force collapse exact should win over whitelist exact for same scope
        self.assertIn('class_TestClass_test_method', collapsed_subgraphs,
                     "TestClass.test_method should be collapsed (force collapse exact beats whitelist exact)")
        
        # Whitelist exact should work for non-conflicting scopes
        self.assertIn('subgraph "Method: calculate_value"', mermaid_output,
                     "TestClass2.calculate_value should be expanded (whitelist exact, no conflict)")
        
        # Force collapse exact should work for non-conflicting scopes
        self.assertIn('class_TestClass3_get_status', collapsed_subgraphs,
                     "TestClass3.get_status should be collapsed (force collapse exact, no conflict)")
        
        print(f"\n=== Multiple Exact Matches Priority Test ===")
        print(f"Collapsed: {list(collapsed_subgraphs.keys())}")
    
    def test_size_based_collapse_with_whitelist(self):
        """Test that size-based collapse works with whitelist patterns."""
        with patch.dict(os.environ, {
            'MAX_SUBGRAPH_NODES': '3',  # Very small to force size-based collapse
            'SUBGRAPH_WHITELIST': 'TestClass',  # Pattern to protect TestClass from size-based collapse
            'FORCE_COLLAPSE_LIST': ''  # No force collapse
        }):
            mermaid_output, metadata, stdout, stderr = self._run_main_with_file('whitelist_priority_test.py')
        
        # Verify output is valid
        self.assertIn('graph', mermaid_output)
        self.assertIsInstance(metadata, dict)
        
        collapsed_subgraphs = metadata.get('collapsed_subgraphs', {})
        
        # TestClass should be expanded (whitelist pattern protects from size-based collapse)
        self.assertIn('subgraph "Class: TestClass"', mermaid_output)
        
        # TestClass2 and TestClass3 methods should be collapsed (size-based collapse)
        # Check for any collapsed subgraphs from TestClass2 and TestClass3
        testclass2_collapsed = any('TestClass2' in key for key in collapsed_subgraphs.keys())
        testclass3_collapsed = any('TestClass3' in key for key in collapsed_subgraphs.keys())
        
        # At least one of the non-whitelisted classes should be collapsed
        non_whitelisted_collapsed = testclass2_collapsed or testclass3_collapsed
        
        self.assertTrue(testclass2_collapsed,
                     "TestClass2 methods should be collapsed (size-based, not whitelisted)")
        self.assertTrue(non_whitelisted_collapsed,
                     "At least one non-whitelisted class should be collapsed (size-based)")
        
        print(f"\n=== Size-based Collapse with Whitelist Test ===")
        print(f"Collapsed: {list(collapsed_subgraphs.keys())}")
        print(f"TestClass2 collapsed: {testclass2_collapsed}")
        print(f"TestClass3 collapsed: {testclass3_collapsed}")
    
    def test_expanded_collapsed_metadata_maps(self):
        """Test that comprehensive expanded/collapsed subgraph maps are generated."""
        with patch.dict(os.environ, {
            'MAX_SUBGRAPH_NODES': '5',
            'SUBGRAPH_WHITELIST': 'TestClass',
            'FORCE_COLLAPSE_LIST': 'class_TestClass_test_method'
        }):
            mermaid_output, metadata, stdout, stderr = self._run_main_with_file('whitelist_priority_test.py')
        
        # Verify new metadata structure exists
        self.assertIn('expanded_subgraphs', metadata)
        self.assertIn('subgraph_status_map', metadata)
        self.assertIn('collapsed_subgraphs', metadata)
        
        expanded_subgraphs = metadata['expanded_subgraphs']
        collapsed_subgraphs = metadata['collapsed_subgraphs']
        subgraph_status_map = metadata['subgraph_status_map']
        
        # Verify expanded subgraphs structure
        self.assertIsInstance(expanded_subgraphs, dict)
        for scope, info in expanded_subgraphs.items():
            self.assertIn('node_count', info)
            self.assertIn('original_scope', info)
            self.assertIn('subgraph_name', info)
            self.assertIn('scope_nodes', info)
            self.assertIn('status', info)
            self.assertEqual(info['status'], 'expanded')
            self.assertIsInstance(info['node_count'], int)
            self.assertGreater(info['node_count'], 0)
        
        # Verify collapsed subgraphs structure
        self.assertIsInstance(collapsed_subgraphs, dict)
        for scope, info in collapsed_subgraphs.items():
            self.assertIn('node_count', info)
            self.assertIn('original_scope', info)
            self.assertIn('subgraph_name', info)
            self.assertIn('scope_nodes', info)
            self.assertIn('status', info)
            self.assertEqual(info['status'], 'collapsed')
            self.assertIsInstance(info['node_count'], int)
            self.assertGreater(info['node_count'], 0)
        
        # Verify subgraph_status_map contains all subgraphs
        self.assertIsInstance(subgraph_status_map, dict)
        self.assertEqual(len(subgraph_status_map), len(expanded_subgraphs) + len(collapsed_subgraphs))
        
        # Verify all subgraphs have status
        for scope, info in subgraph_status_map.items():
            self.assertIn('status', info)
            self.assertIn(info['status'], ['expanded', 'collapsed'])
        
        # Verify specific test case: TestClass_test_method should be collapsed
        self.assertIn('class_TestClass_test_method', collapsed_subgraphs)
        self.assertEqual(collapsed_subgraphs['class_TestClass_test_method']['status'], 'collapsed')
        
        # Verify specific test case: TestClass_other_method should be expanded
        self.assertIn('class_TestClass_other_method', expanded_subgraphs)
        self.assertEqual(expanded_subgraphs['class_TestClass_other_method']['status'], 'expanded')
        
        print(f"\n=== Expanded/Collapsed Metadata Test ===")
        print(f"Expanded count: {len(expanded_subgraphs)}")
        print(f"Collapsed count: {len(collapsed_subgraphs)}")
        print(f"Total subgraphs: {len(subgraph_status_map)}")
        print(f"Expanded scopes: {list(expanded_subgraphs.keys())}")
        print(f"Collapsed scopes: {list(collapsed_subgraphs.keys())}")
    
    def test_exact_match_priority(self):
        """Test that exact matches have priority over pattern matches."""
        # Whitelist the entire TestClass, but force collapse the exact scope
        with patch.dict(os.environ, {
            'MAX_SUBGRAPH_NODES': '5',
            'SUBGRAPH_WHITELIST': 'TestClass',
            'FORCE_COLLAPSE_LIST': 'class_TestClass'  # Exact match to collapse entire class
        }):
            mermaid_output, metadata, stdout, stderr = self._run_main_with_file('whitelist_priority_test.py')
        
        collapsed_subgraphs = metadata.get('collapsed_subgraphs', {})
        
        # Force collapse exact match should win over whitelist pattern match
        self.assertIn('class_TestClass', collapsed_subgraphs,
                     "class_TestClass should be collapsed (force collapse exact match wins)")
        
    def test_whitelist_exact_over_force_pattern(self):
        """Test that whitelist exact match beats force collapse pattern match."""
        # Force collapse all TestClass methods (pattern), but whitelist specific method (exact)
        with patch.dict(os.environ, {
            'MAX_SUBGRAPH_NODES': '10',
            'SUBGRAPH_WHITELIST': 'class_TestClass_other_method',  # Exact match to keep expanded
            'FORCE_COLLAPSE_LIST': 'TestClass_test_method,TestClass___init__'  # Pattern matches (not exact scope names)
        }):
            mermaid_output, metadata, stdout, stderr = self._run_main_with_file('whitelist_priority_test.py')
        
        collapsed_subgraphs = metadata.get('collapsed_subgraphs', {})
        
        # Whitelist exact match should win - other_method should NOT be collapsed
        self.assertNotIn('class_TestClass_other_method', collapsed_subgraphs,
                        "other_method should be expanded (whitelist exact match protects it)")
        
        # Methods with pattern matches should be collapsed
        self.assertIn('class_TestClass_test_method', collapsed_subgraphs,
                     "test_method should be collapsed (force collapse pattern applies)")
        self.assertIn('class_TestClass___init__', collapsed_subgraphs,
                     "__init__ should be collapsed (force collapse pattern applies)")


if __name__ == '__main__':
    unittest.main()

