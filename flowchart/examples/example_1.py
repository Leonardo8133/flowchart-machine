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
            result = helper_function(i)
        else:
            print(f"{i} is odd, skipping helper_function.")

    count = 0
    while count < 3:
        print(f"While loop iteration {count + 1}")
        count += 1

    print("Example function completed.")

example_function()