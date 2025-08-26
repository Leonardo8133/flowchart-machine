"""
Test file to verify the fixed class subgraph behavior.
Classes should be wrapped in subgraphs with method subgraphs containing their body nodes.
"""

class SimpleClass:
    """A simple class for testing subgraphs."""
    
    def __init__(self, name):
        self.name = name
        self.value = 0
        print(f"Created {name}")
    
    def get_name(self):
        return self.name
    
    def set_value(self, value):
        self.value = value
        print(f"Set value to {value}")
        return self.value

class ComplexClass:
    """A more complex class with multiple methods."""
    
    def __init__(self, data):
        self.data = data
        self.processed = False
        print("Initializing complex class")
    
    def process_data(self):
        if not self.processed:
            self.data = self.data.upper()
            self.processed = True
            print("Data processed")
    
    def get_result(self):
        return self.data

# Main execution flow - these should appear in Main Flow subgraph
print("Starting class subgraph test")

# Create instances - these should connect to class subgraphs
simple = SimpleClass("test")
complex_obj = ComplexClass("hello world")

# Use methods - these should connect to class subgraphs
simple.set_value(42)
complex_obj.process_data()
result = complex_obj.get_result()

print(f"Final result: {result}")
print("Class subgraph test completed")
