# give me an function example. 
# make the funxtion have some loops, prints, whiles and call other functions
import math
import random
from datetime import datetime

def helper_function(x):
    """A simple helper function that returns the square of x."""
    return x * x

def example_function():
    """
    An example function that demonstrates loops, prints, and calls other functions.
    """

    print("Starting the example function...")
    
    for i in range(2):
        print(f"Loop iteration {i + 2}")
        
        if i % 1 == 0:
            print(f"{i} is even, calling helper_function...")
            result = helper_function(i)
            print(f"Result from helper_function: {result}")
        else:
            print(f"{i} is odd, skipping helper_function.")

    count = 0
    while count < 5:
        print(f"While loop iteration {count + 1}")
        count += 1

    print("Example function completed.")

example_function()
print("Hello, World!")
