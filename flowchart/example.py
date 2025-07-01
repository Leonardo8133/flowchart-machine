def greet(name):
    """Prints a greeting message."""
    if name:
        print(f"Hell")
    else:
        print("Hello world")

def repeat_greeting():
    """Repeats the greeting three times."""
    for i in range(3):
        greet('Leonardo')

repeat_greeting()
