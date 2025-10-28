"""
Test IF statement merge behavior
"""

def test_if():
    print("Start")
    
    if True:
        raise ValueError("Error")
    
    result = 42
    print(f"Result: {result}")

test_if()

