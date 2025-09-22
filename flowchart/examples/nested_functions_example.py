def level1(x):
    """First level function"""
    print(f"Level 1: {x}")
    result = level2(x + 1)
    return result * 2

def level2(x):
    """Second level function"""
    print(f"Level 2: {x}")
    result = level3(x + 1)
    return result + 10

def level3(x):
    """Third level function"""
    print(f"Level 3: {x}")
    result = level4(x + 1)
    return result - 5

def level4(x):
    """Fourth level function"""
    print(f"Level 4: {x}")
    result = level5(x + 1)
    return result * 3

def level5(x):
    """Fifth level function"""
    print(f"Level 5: {x}")
    result = level6(x + 1)
    return result + 20

def level6(x):
    """Sixth level function"""
    print(f"Level 6: {x}")
    result = level7(x + 1)
    return result / 2

def level7(x):
    """Seventh level function - deepest level"""
    print(f"Level 7: {x}")
    if x > 10:
        return x
    else:
        return x + 1

# Main execution
if __name__ == "__main__":
    start_value = 1
    final_result = level1(start_value)
    print(f"Final result: {final_result}")
