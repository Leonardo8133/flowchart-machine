"""
Class method call test case for debugging subgraph generation.
"""

class TestClass:
    def __init__(self):
        self.value = 1
        print("Constructor called")
    
    def test_method(self):
        print("test method")
        return self.value
    
    def other_method(self):
        print("other method")
        return 42
    
    def calculate_value(self):
        print("This should not be executed")
        return 0

class TestClass2:
    def __init__(self):
        self.value = 2
        print("TestClass2 constructor")
    
    def calculate_value(self):
        print("TestClass2.calculate_value")
        return 25 * 12

# Test static method calls
TestClass.test_method()
TestClass.other_method()

# Test instance method calls
obj1 = TestClass()
result1 = obj1.test_method()

obj2 = TestClass2()
result2 = obj2.calculate_value()

print(f"Results: {result1}, {result2}")
