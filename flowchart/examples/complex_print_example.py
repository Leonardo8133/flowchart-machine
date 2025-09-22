def multiply(a, b):
    """Multiply two numbers"""
    result = a * b
    print(f"Multiplying {a} * {b}")
    return result

def add(a, b):
    """Add two numbers"""
    result = a + b
    print(f"Adding {a} + {b}")
    return result

# Test with multiple function calls in print
print(f"Result: {add(multiply(2, 3), multiply(4, 5))}")
