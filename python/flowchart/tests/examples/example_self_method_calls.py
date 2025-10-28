"""
Test file for self method calls within methods.
"""
class TestClass:
    def __init__(self):
        self.value = 1
        print("Constructor called")
    
    def test_method(self):
        print("test method")
        return self.other_method()  # This should call other_method
    
    def other_method(self):
        print("other method")
        self.print_value()
        return 42
    
    def print_value(self):
        print(f"Value: {self.value}")
    
    def chain_method(self):
        print("chain method")
        return self.helper_method()
    
    def helper_method(self):
        print("helper called")
        return self.value

# Test instance
obj = TestClass()
result1 = obj.test_method()
result2 = obj.chain_method()

print(f"Results: {result1}, {result2}")

