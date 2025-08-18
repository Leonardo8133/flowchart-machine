def test_function():
    """Test function to check connections."""
    for i in range(2):
        print(f"Loop iteration {i + 2}")
        if i % 1 == 0:
            print(f"{i} is even, calling helper_function...")
    
    x = 5
    y = x + 1
    return y

# Main execution
result = test_function()
print(f"Result: {result}")
