from .base import TestFlowchartMain

class TestFlowchartFunctions(TestFlowchartMain):
    def test_simple_function(self):
        mermaid_output, metadata, stdout, stderr = self._run_main_with_file('simple_function.py')
        
        # Verify output is valid Mermaid syntax
        self.assertIn('graph TD', mermaid_output)
        self.assertIsInstance(metadata, dict)
        
        # Verify key nodes exist
        self._assert_node_exists(mermaid_output, 'Start')
        self._assert_node_exists(mermaid_output, 'End')
        self._assert_node_exists(mermaid_output, 'Call: hello_world()')
        self._assert_node_exists(mermaid_output, 'result = calculate_sum(5, 3)')
        
        # Verify function subgraphs are created (2 functions)
        self.assertEqual(self._count_subgraphs(mermaid_output), 2, "Should have 2 function subgraphs")
        self.assertIn('subgraph "Function: hello_world()"', mermaid_output)
        self.assertIn('subgraph "Function: calculate_sum()"', mermaid_output)
        
        # Verify function internals for hello_world()
        self._assert_node_exists(mermaid_output, 'print(`Hello, World!`)')
        self._assert_node_exists(mermaid_output, "return 'success'")
        self.assertIn('result = a + b', mermaid_output)
        
        # Verify function internals for calculate_sum()
        self._assert_node_exists(mermaid_output, 'result = a + b')
        self._assert_node_exists(mermaid_output, 'return result')
        
        # Verify key connections exist
        self.assertIn('start1 --> ', mermaid_output)  # Start connects
        self.assertIn('--> end2', mermaid_output)      # Something connects to end
        
        # Verify node count (start + end + 3 main flow + 2 in hello_world + 2 in calculate_sum = 9+)
        node_count = mermaid_output.count('[')
        self.assertGreaterEqual(node_count, 9, "Should have at least 9 nodes")
        
        # Verify specific connections
        self.assertIn('start1 --> expr3', mermaid_output)
        self.assertIn('call_hello_world4 --> print6', mermaid_output)
        self.assertIn('assign8 --> assign10', mermaid_output)
        self.assertIn('print12 --> end2', mermaid_output)
    
    def test_function_with_entry_function(self):
        mermaid_output, metadata, stdout, stderr = self._run_main_with_file(
            'simple_function.py',
            entry_type='function',
            entry_name='calculate_sum'
        )
        
        # Verify output is valid
        self.assertIn('graph', mermaid_output)
        self.assertIsInstance(metadata, dict)
        
        # Check if calculate_sum function is the entry point
        self.assertEqual(metadata['entry_selection']['type'], 'function')
        self.assertEqual(metadata['entry_selection']['name'], 'calculate_sum')
        
        # Verify that the function is the entry point
        self.assertIn('calculate_sum', mermaid_output)
        self.assertNotIn('hello_world', mermaid_output)
        
        # Verify that the return node of calculate_sum is connected to end2 (number is dynamic)
        import re
        pattern = r'return\d+ --> end2'
        self.assertRegex(mermaid_output, pattern)