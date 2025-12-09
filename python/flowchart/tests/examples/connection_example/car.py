from connection_example.brands import Brand
from connection_example.sale import Engine

class Car:
    def __init__(self, brand: Brand, model: str, year: int, engine: Engine):
        self.brand = brand
        self.model = model
        self.year = year
        self.engine = engine

    def engine(self):
        return self.engine

    def brand(self):
        return self.brand

    def model(self):
        return self.model

    def year(self):
        return self.year

def create_car():
    return Car(brand=Brand("Toyota"), model="Corolla", year=2024, engine=Engine(horsepower=100, fuel_type="Gasoline"))
