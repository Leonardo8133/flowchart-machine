def test_function():
    x = 10
    
    if x > 5:
        print("x is greater than 5")
        x = x + 1
    
    if x < 20:
        print("x is less than 20")
    else:
        print("x is 20 or greater")
    
    return x

# Test the function
result = test_function()
print(f"Result: {result}")
