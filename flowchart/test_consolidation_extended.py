# Test file for extended consolidation features
# This should test consolidation of prints, assignments, and augmented assignments

# Simple assignments that should consolidate
x = 10
y = 20
z = 30

# Print statements that should consolidate
print("First message")
print("Second message")
print("Third message")

# More assignments
a = x + y
b = y + z

# Augmented assignments that should consolidate
x += 1
y += 2
z += 3

# Function call assignment - should NOT consolidate
result = some_function()

# Print after function call
print(f"Result: {result}")

# More simple assignments
count = 0
total = 0

# More augmented assignments
count += 1
total += count

# Final print
print("Done!")
