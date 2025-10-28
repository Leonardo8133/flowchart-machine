"""
Test file for whitelist and force collapse priority testing.
This file contains 3 classes with various methods to test the priority system.
"""

class TestClass:
    def __init__(self):
        self.value = 0
        print("TestClass initialized")
    
    def test_method(self):
        print("TestClass.test_method called")
        self.value += 1
        return self.value
    
    def other_method(self):
        print("TestClass.other_method called")
        return self.value * 2
    
    def calculate_value(self):
        print("TestClass.calculate_value called")
        return self.value * 10

class TestClass2:
    def __init__(self):
        self.data = []
        print("TestClass2 initialized")
    
    def calculate_value(self):
        print("TestClass2.calculate_value called")
        return len(self.data) * 5
    
    def process_data(self):
        print("TestClass2.process_data called")
        self.data.append("processed")
        return self.data

class TestClass3:
    def __init__(self):
        self.status = "active"
        print("TestClass3 initialized")
    
    def get_status(self):
        print("TestClass3.get_status called")
        return self.status
    
    def update_status(self, new_status):
        print(f"TestClass3.update_status called with {new_status}")
        self.status = new_status
        return self.status

# Test the classes
obj1 = TestClass()
result1 = obj1.test_method()
result2 = obj1.other_method()
result3 = obj1.calculate_value()

obj2 = TestClass2()
result4 = obj2.calculate_value()
result5 = obj2.process_data()

obj3 = TestClass3()
status = obj3.get_status()
obj3.update_status("inactive")

print(f"Results: {result1}, {result2}, {result3}, {result4}, {result5}, {status}")


