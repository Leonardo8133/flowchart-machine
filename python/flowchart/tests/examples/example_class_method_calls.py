# type: ignore
"""
Class method call test case for debugging subgraph generation.
"""

class TestClass:
    def __init__(self):
        self.value = 1
        print("Constructor called")
    
    def test_method(self):
        print("test method")
        return self.other_method()  # Call another method
    
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

class TestClass3:
    def __init__(self):
        self.value = 3
        print("TestClass3 constructor")
    
    def call_another_class(self):
        print("Calling another class from TestClass3")
        obj = TestClass2()
        self.value = TestClass2.calculate_value()  # Should show error: instance method called on class
        return obj.calculate_value()

# Test static method calls
TestClass.test_method()
TestClass.other_method()

# Test instance method calls
obj1 = TestClass()
result1 = obj1.test_method()

obj2 = TestClass2()
result2 = obj2.calculate_value()

result3 = TestClass3().call_another_class()

print(f"Results: {result1}, {result2}, {result3}")
