"""
Test sequential flow mode
"""
class TestClass:
    def __init__(self):
        self.value = 0
    
    def increment(self):
        self.value += 1
        return self.value
    
    def add(self, x):
        self.value += x
        return self.value

# Test sequential flow
obj = TestClass()
obj.increment()  # Expression call
result = obj.add(5)  # Assignment call
print(f"Result: {result}")

