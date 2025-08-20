import os
import sys
from pathlib import Path

def test_function():
    """Test function with augmented assignments"""
    count = 0
    count += 1
    count += 2
    count *= 3
    
    x = 10
    x -= 5
    x /= 2
    
    if count > 5:
        print(f"Count is {count}")
        count -= 1
    else:
        print(f"Count is {count}")
        count += 1
    
    return count

def main():
    result = test_function()
    print(f"Final result: {result}")

if __name__ == "__main__":
    main()
