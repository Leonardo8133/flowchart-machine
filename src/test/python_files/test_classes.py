class TestClass:
    def __init__(self):
        self.value = 0
    
    def test_method(self):
        print("test method")
        return self.value
    
    def other_method(self):
        print("other method")
        return 42

class TestClass3:
    def __init__(self):
        self.value = 0
    
    def call_another_class(self):
        self.value = TestClass2().calculate_value()
        # self.value = TestClass2.calculate_value()

class TestClass2:
    def __init__(self):
        self.value = 0
    
    def calculate_value(self):
        print("TestClass2.calculate_value")
        return 25 * 12
    
    def calculate_value2(self):
        return 25 * 12

def standalone_function():
    print("standalone")
    return 1

print(TestClass2())
TestClass3().call_another_class()