class Brand:
    def __init__(self, name):
        self.name = name

    def get_name(self):
        return self.name

def create_brand():
    return Brand("Toyota")