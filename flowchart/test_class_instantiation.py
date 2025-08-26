class TestClass:
    def __init__(self, name):
        self.name = name
        print(f"Initialized {self.name}")
    
    def some_method(self):
        return f"Hello {self.name}"

# Test instantiation
obj = TestClass("TestObject")
result = obj.some_method()
print(result)
