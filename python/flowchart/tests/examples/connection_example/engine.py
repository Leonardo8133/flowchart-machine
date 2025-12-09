class Engine:
    def __init__(self, horsepower: int, fuel_type: str):
        self.horsepower = horsepower
        self.fuel_type = fuel_type

    def horsepower(self):
        return self.horsepower

    def fuel_type(self):
        return self.fuel_type

def create_engine():
    return Engine(horsepower=100, fuel_type="Gasoline")