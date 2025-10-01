class SimpleClass:
    def __init__(self):
        self.value = 0
    
    def set_value(self, new_value):
        self.value = new_value
        return self.value
    
    def get_value(self):
        return self.value

def standalone_function():
    print("standalone")
    return 1
