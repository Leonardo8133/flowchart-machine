"""
Simple function test case for debugging flowchart generation.
"""

def hello_world():
    print("Hello, World!")
    return "success"

def calculate_sum(a, b):
    result = a + b
    print(f"Sum: {result}")
    return result

# Test the functions
hello_world()
result = calculate_sum(5, 3)
print(f"Final result: {result}")
