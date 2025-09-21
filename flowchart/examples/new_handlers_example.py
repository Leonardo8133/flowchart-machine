#!/usr/bin/env python3
"""
Example script demonstrating the new handlers:
- WithHandler (context managers)
- AssertHandler (assertions)
- PassHandler (pass statements)
- LambdaHandler (lambda expressions)
- ComprehensionHandler (list/dict/set comprehensions)
"""

def process_file(filename):
    """Process a file using context manager."""
    with open(filename, 'r') as f:
        data = f.read()
        assert len(data) > 0, "File is empty"
        return data

def process_data(data):
    """Process data with various Python constructs."""
    if not data:
        pass  # Empty data, do nothing
        return []
    
    # List comprehension with condition
    words = [word.upper() for word in data.split() if word.strip()]
    
    # Dictionary comprehension
    word_counts = {word: words.count(word) for word in set(words)}
    
    # Set comprehension
    unique_words = {word.lower() for word in words}
    
    # Lambda function
    double_count = lambda x: x * 2
    
    # Generator expression
    doubled_words = (double_count(word) for word in words)
    
    return list(doubled_words)

def main_function():
    """Main function demonstrating all handlers."""
    try:
        # Test with statement
        with open('test.txt', 'w') as f:
            f.write("Hello World Python")
        
        # Test assert statement
        assert True, "This should always pass"
        
        # Test pass statement
        if False:
            pass  # This will never execute
        
        # Test lambda expression
        square = lambda x: x ** 2
        result = square(5)
        
        # Test list comprehension
        numbers = [1, 2, 3, 4, 5]
        squares = [square(n) for n in numbers if n % 2 == 0]
        
        # Test dict comprehension
        square_dict = {n: square(n) for n in numbers}
        
        # Test set comprehension
        even_squares = {square(n) for n in numbers if n % 2 == 0}
        
        print("All handlers working correctly!")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main_function()
    print("Main function completed")
