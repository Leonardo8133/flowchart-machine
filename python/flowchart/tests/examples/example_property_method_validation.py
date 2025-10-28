"""
Test case for property vs method validation.

This tests:
1. Accessing a valid property
2. Accessing a non-existent property (should show "Property not found")
3. Calling a valid method
4. Not confusing properties with methods
"""

class User:
    def __init__(self, name):
        self.name = name
        self.email = "test@example.com"
    
    def get_info(self):
        return f"{self.name} - {self.email}"
    
    def update_email(self, new_email):
        self.email = new_email

# Test cases
user = User("John")

# Valid property access
if user.name:
    print("Has name")

# Valid method call
info = user.get_info()

# Access non-existent property (should create "Property not found" node)
if user.age:  # age property doesn't exist
    print("Has age")

# Call non-existent method (should create "Method not found" node)
user.delete()  # delete method doesn't exist


