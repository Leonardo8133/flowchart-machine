"""
Test cases for __init__ tracking and redundant call detection.
"""

import unittest
import os
from .base import TestFlowchartMain

class TestInitTracking(TestFlowchartMain):
    def test_init_tracking_comparison(self):
        """Test that proper instantiation works and redundant __init__ calls show warnings."""
        mermaid_output, metadata, stdout, stderr = self._run_main_with_file(
            'init_tracking_comparison.py'
        )
        
        # Verify output is valid
        self.assertIn('graph', mermaid_output)
        self.assertIsInstance(metadata, dict)
        
        # Check that TestClass1 is properly instantiated and tracked
        self.assertIn('obj1 = TestClass1()', mermaid_output)
        self.assertIn('subgraph "Class: TestClass1"', mermaid_output)
        self.assertIn('Constructor: __init__()', mermaid_output)
        self.assertIn('TestClass1 constructor', mermaid_output)
        
        # Check that TestClass2 shows warning for redundant __init__ call
        self.assertIn('obj2 = TestClass2().__init__()', mermaid_output)
        self.assertIn('subgraph "Class: TestClass2"', mermaid_output)
        self.assertIn('Constructor: __init__()', mermaid_output)
        self.assertIn('TestClass2 constructor', mermaid_output)
        self.assertIn('⚠️ Redundant __init__ call: TestClass2() already calls constructor', mermaid_output)
        
        # Verify that TestClass2's __init__ is actually called (showing the instantiation happened)
        self.assertIn('Call and Return', mermaid_output)
        
        # Check that TestClass1 method call works
        self.assertIn('obj1.calculate_value()', mermaid_output)
        self.assertIn('Method: calculate_value()', mermaid_output)
        
        # Check that TestClass2 method call shows error (since obj2 is None)
        self.assertIn('obj2.calculate_value()', mermaid_output)
        self.assertIn('❌ Could not resolve class for method', mermaid_output)
        
        # Verify the flow shows both scenarios
        self.assertIn('result1 = obj1.calculate_value()', mermaid_output)
        self.assertIn('result2 = obj2.calculate_value()', mermaid_output)
        
        # Note: TestClass2 constructor is not called because the system stops processing
        # when it encounters the error with TestClass2().__init__()
        
        # Verify proper connections
        self.assertIn('obj1 = TestClass1()', mermaid_output)
        self.assertIn('obj2 = TestClass2().__init__()', mermaid_output)

    def test_init_tracking_with_entry_testclass2_init(self):
        """Test that when entry point is TestClass2.__init__, the correct constructor is called."""
        mermaid_output, metadata, stdout, stderr = self._run_main_with_file(
            'init_tracking_comparison.py',
            entry_type='class',
            entry_class='TestClass2',
            entry_name='__init__'
        )
        
        # Verify output is valid
        self.assertIn('graph', mermaid_output)
        self.assertIsInstance(metadata, dict)
        
        # Check that TestClass2 subgraph is created
        self.assertIn('subgraph "Class: TestClass2"', mermaid_output)
        
        # Check that TestClass2's __init__ is shown and called
        self.assertIn('Constructor: __init__()', mermaid_output)
        self.assertIn('TestClass2 constructor', mermaid_output)
        
        # Verify that TestClass2's __init__ body is present
        self.assertIn('self.value = 2', mermaid_output)
        
        # Check that start node connects to the constructor
        self.assertIn('Start', mermaid_output)
        self.assertIn('End', mermaid_output)
        
        # Verify that TestClass2.__init__() is called as entry point
        self.assertIn('TestClass2.__init__()', mermaid_output)
        
        # Only TestClass2 should be present (not TestClass1)
        self.assertIn('subgraph "Class: TestClass2"', mermaid_output)
        self.assertNotIn('subgraph "Class: TestClass1"', mermaid_output)
        self.assertNotIn('TestClass1 constructor', mermaid_output)
        
        # The file-level code (obj1, obj2 assignments) should NOT be present
        self.assertNotIn('obj1 = TestClass1()', mermaid_output)
        self.assertNotIn('obj2 = TestClass2().__init__()', mermaid_output)
        self.assertNotIn('result1 = obj1.calculate_value()', mermaid_output)
        self.assertNotIn('result2 = obj2.calculate_value()', mermaid_output)
        
        # Verify that the correct __init__ is called (TestClass2, not TestClass1)
        # The output should have value = 2, not value = 1
        self.assertIn('self.value = 2', mermaid_output)
        self.assertNotIn('self.value = 1', mermaid_output)


if __name__ == '__main__':
    unittest.main()
