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
        # OR sequential arrows with "Call" label (depending on mode)
        self.assertTrue(
            '<-->|Call and Return|' in mermaid_output or '-->|Call|' in mermaid_output,
            "Should have either bidirectional or sequential connections"
        )
        
        # Check that constructor calls have "Call and Return" label OR "Call" label
        self.assertTrue(
            '<-->|Call and Return|' in mermaid_output or '-->|Call|' in mermaid_output,
            "Should have either bidirectional or sequential connections"
        )
        
        # Verify the flow continues after method calls
        # In sequential flow: return12 --> method_call13 (return connects to next call)
        # In traditional flow: method_call8 --> method_call13 (call connects to next call)
        self.assertTrue(
            'method_call8 --> method_call13' in mermaid_output or 'return12 --> method_call13' in mermaid_output,
            "Should have either traditional or sequential flow connections"
        )
        self.assertTrue(
            'method_call13 --> assign18' in mermaid_output or 'return17 --> assign18' in mermaid_output,
            "Should have either traditional or sequential flow connections"
        )
        
        # Verify start and end connections
        self.assertIn('start1 --> expr3', mermaid_output, "Start should connect to description")
        self.assertIn('print21 --> end2', mermaid_output, "Last statement should connect to end")
        
        # Verify main flow sequence
        self.assertIn('expr3 --> assign5', mermaid_output, "Description should connect to instantiation")
        # Check that instantiation connects to __init__, then instantiation connects to next operation
        # In sequential flow: assign5 -->|Call| method___init__6
        # In traditional flow: assign5 <-->|Call and Return| method___init__6
        self.assertTrue(
            'assign5 <-->|Call and Return| method___init__6' in mermaid_output or 'assign5 -->|Call| method___init__6' in mermaid_output,
            "Instantiation should connect to __init__"
        )
        # In sequential flow: assign7 --> method_call8 (constructor exit connects to next call)
        # In traditional flow: assign5 --> method_call8 (instantiation connects to next call)
        self.assertTrue(
            'assign5 --> method_call8' in mermaid_output or 'assign7 --> method_call8' in mermaid_output,
            "After __init__ call, should connect to first method call"
        )
        # In sequential flow: return20 --> print21 (return connects to next statement)
        # In traditional flow: assign18 --> print21 (assignment connects to next statement)
        self.assertTrue(
            'assign18 --> print21' in mermaid_output or 'return20 --> print21' in mermaid_output,
            "Last method call should connect to final print"
        )
        
        # Verify constructor call connection
        self.assertTrue(
            'assign5 <-->|Call and Return| method___init__6' in mermaid_output or 'assign5 -->|Call| method___init__6' in mermaid_output,
            "Instantiation should call constructor"
        )
        
        # Verify method call connections (bidirectional OR sequential)
        self.assertTrue(
            'method_call8 <-->|Call and Return| method_add9' in mermaid_output or 'method_call8 -->|Call| method_add9' in mermaid_output,
            "Method call should have connection"
        )
        self.assertTrue(
            'method_call13 <-->|Call and Return| method_multiply14' in mermaid_output or 'method_call13 -->|Call| method_multiply14' in mermaid_output,
            "Method call should have connection"
        )
        self.assertTrue(
            'assign18 <-->|Call and Return| method_get_value19' in mermaid_output or 'assign18 -->|Call| method_get_value19' in mermaid_output,
            "Method call with assignment should have connection"
        )
        
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
        self.assertTrue(
            '<-->|Call and Return|' in mermaid_output or '-->|Call|' in mermaid_output,
            "Should have either bidirectional or sequential connections"
        )
        
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
        self.assertIn('❌ Instance method \'other_method\' called on class \'TestClass\' without instantiation', mermaid_output, "Should show error nodes for uninstanciated class method calls")
        self.assertIn('❌ Instance method \'test_method\' called on class \'TestClass\' without instantiation', mermaid_output, "Should show error nodes for uninstanciated class method calls")
        self.assertIn('Method', mermaid_output)
        
        # Check return connections for correct instance method calls with assignments
        self.assertIn('result1 = obj1.test_method()', mermaid_output)
        self.assertIn('result2 = obj2.calculate_value()', mermaid_output)
        
        # Verify bidirectional arrows exist for valid method calls
        # (Valid method calls should get bidirectional arrows OR sequential arrows)
        self.assertTrue(
            '<-->|Call and Return|' in mermaid_output or '-->|Call|' in mermaid_output,
            "Should have either bidirectional or sequential connections"
        )

        self.assertIn('TestClass3().call_another_class', mermaid_output)

        self.assertIn('Class: TestClass3', mermaid_output)

        self.assertIn('Method: calculate_value()', mermaid_output)
        
        self.assertNotIn('❌ Could not resolve class for method \'call_another_class\'', mermaid_output)
        
        # Check for error when calling instance method on class without instantiation inside a method
        self.assertIn('❌ Instance method \'calculate_value\' called on class \'TestClass2\' without instantiation', mermaid_output, "Should show error for TestClass2.calculate_value() called directly on class")


    
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
        # OR user = User('John') -->|Call| Constructor: __init__(name) (in sequential flow)
        self.assertTrue(
            'Call and Return' in mermaid_output or '-->|Call|' in mermaid_output,
            "Should have either bidirectional or sequential connections"
        )
        
        # Verify that the method call connects to the method subgraph
        # info = user.get_info() should connect to Method: get_info()
        self.assertTrue(
            'Call and Return' in mermaid_output or '-->|Call|' in mermaid_output,
            "Should have either bidirectional or sequential connections"
        )
        
        # Verify True/False labels are present for if statements
        self.assertIn('|True|', mermaid_output)
        self.assertIn('|False|', mermaid_output)

    def test_using_self_in_method(self):
        """Test that self.method() calls within methods are properly tracked."""
        with patch.dict(os.environ, {
            'MAX_SUBGRAPH_NODES': '10'
        }):
            mermaid_output, metadata, stdout, stderr = self._run_main_with_file('self_method_calls.py')
            
        # Verify that test_method calls other_method
        self.assertIn('Method: other_method()', mermaid_output,
                     "other_method should be called by test_method")
        
        # Verify the connection exists
        # Looking for "other_method" in a method call context
        # The pattern should be: return self.other_method() --> Method: other_method()
        
        # Verify that chain_method calls helper_method
        self.assertIn('Method: helper_method()', mermaid_output,
                     "helper_method should be called by chain_method")

        self.assertIn('self.print_value()', mermaid_output,
                     "print_value should be called by other_method")
        
        # Verify return statements with self calls are tracked
        self.assertIn('return self.other_method()', mermaid_output,
                     "Return statement should show method call")
        
        self.assertIn('return self.helper_method()', mermaid_output,
                     "Return statement should show helper call")
        
        # Verify the methods exist in the subgraph
        self.assertIn('subgraph "Method: test_method"', mermaid_output,
                     "test_method subgraph should exist")
        
        self.assertIn('subgraph "Method: other_method"', mermaid_output,
                     "other_method subgraph should exist")
        


if __name__ == '__main__':
    unittest.main()

