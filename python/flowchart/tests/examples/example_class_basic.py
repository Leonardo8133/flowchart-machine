"""
Basic class test case for debugging flowchart generation.
"""

class Calculator:
    def __init__(self):
        self.value = 0
        print("Calculator initialized")
    
    def add(self, number):
        self.value += number
        print(f"Added {number}, new value: {self.value}")
        return self.value
    
    def multiply(self, number):
        self.value *= number
        print(f"Multiplied by {number}, new value: {self.value}")
        return self.value
    
    def get_value(self):
        return self.value

# Test the class
calc = Calculator()
calc.add(5)
calc.multiply(3)
result = calc.get_value()
print(f"Final result: {result}")
