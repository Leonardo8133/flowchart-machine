"""
Test method call on None object.
"""

class TestClass:
    def method(self):
        return "test"

# This should cause a type resolution error
obj = None
result = obj.method()  # This should show an error node

print(f"Result: {result}")
