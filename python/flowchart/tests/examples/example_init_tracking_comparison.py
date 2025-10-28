"""
Test case comparing proper instantiation vs redundant __init__ calls.

This demonstrates:
1. TestClass1: Proper instantiation obj1 = TestClass1() - should track to class and show constructor
2. TestClass2: Redundant __init__ call obj2 = TestClass2().__init__() - should show warning
"""

class TestClass1:
    def __init__(self):
        self.value = 1
        print("TestClass1 constructor")
    
    def calculate_value(self):
        print("TestClass1.calculate_value")
        return 10

class TestClass2:
    def __init__(self):
        self.value = 2
        print("TestClass2 constructor")
    
    def calculate_value(self):
        print("TestClass2.calculate_value")
        return 20

# PROPER: This should work and track to TestClass1
obj1 = TestClass1()
result1 = obj1.calculate_value()

# REDUNDANT: This should show warning about redundant __init__ call
obj2 = TestClass2().__init__()
result2 = obj2.calculate_value()  # This should show error since obj2 is None

print(f"Results: {result1}, {result2}")
