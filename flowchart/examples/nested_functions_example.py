def level1(x):
    """First level function"""
    print(f"Level 1: {x}")
    result = level2(x + 1)
    result = test_function(result)

    return result * 2

def level2(x):
    """Second level function"""
    print(f"Level 2: {x}")
    result = level3(x + 1)
    result = test_function(result)
    return result + 10

def level3(x):
    """Third level function"""
    print(f"Level 3: {x}")
    return x + 1

def test_function(x):
    """Test function"""
    for i in range(10):
        print(f"Test function: {i}")
    if x > 10:
        return x
    else:
        return x + 1
    return 10

# Main execution
if __name__ == "__main__":
    start_value = 1
    final_result = level1(start_value)
    print(f"Final result: {final_result}")
