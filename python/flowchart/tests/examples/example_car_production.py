"""
Car Production Workflow Example

This example demonstrates a car production pipeline with multiple stages:
- Design
- Mounting
- Building
- Selling
"""

class ProductionLine:
    """Main production line class that coordinates car manufacturing."""
    
    def __init__(self, factory_name: str, capacity: int):
        """Initialize the production line with factory details."""
        self.factory_name = factory_name
        self.capacity = capacity
        self.cars_produced = 0
        self.design_department = DesignDepartment()
        self.mounting_department = MountingDepartment()
        self.building_department = BuildingDepartment()
        self.sales_department = SalesDepartment()
    
    def run_full_production(self, car_model: str, quantity: int):
        """Run the complete car production process."""
        print(f"Starting production of {quantity} {car_model} cars")
        
        # Design phase
        design_result = self.design_car(car_model)
        if not design_result:
            print("Design phase failed")
            return False
        
        # Mounting phase
        mounting_result = self.mount_car(car_model, quantity)
        if not mounting_result:
            print("Mounting phase failed")
            return False
        
        # Building phase
        building_result = self.build_car(car_model, quantity)
        if not building_result:
            print("Building phase failed")
            return False
        
        # Sales phase
        sales_result = self.sell_car(car_model, quantity)
        if not sales_result:
            print("Sales phase failed")
            return False
        
        self.cars_produced += quantity
        print(f"Successfully produced {quantity} {car_model} cars")
        return True
    
    def design_car(self, car_model: str):
        """Design the car specifications."""
        print(f"Designing {car_model}")
        return self.design_department.create_design(car_model)
    
    def mount_car(self, car_model: str, quantity: int):
        """Mount car components."""
        print(f"Mounting {quantity} {car_model} cars")
        return self.mounting_department.mount_components(car_model, quantity)
    
    def build_car(self, car_model: str, quantity: int):
        """Build the complete car."""
        print(f"Building {quantity} {car_model} cars")
        return self.building_department.assemble_car(car_model, quantity)
    
    def sell_car(self, car_model: str, quantity: int):
        """Sell the completed cars."""
        print(f"Selling {quantity} {car_model} cars")
        return self.sales_department.process_sale(car_model, quantity)


class DesignDepartment:
    """Handles car design and specifications."""
    
    def create_design(self, car_model: str):
        """Create design specifications for the car."""
        print(f"Creating design for {car_model}")
        return True


class MountingDepartment:
    """Handles component mounting."""
    
    def mount_components(self, car_model: str, quantity: int):
        """Mount all car components."""
        print(f"Mounting components for {quantity} {car_model} cars")
        return True


class BuildingDepartment:
    """Handles car assembly."""
    
    def assemble_car(self, car_model: str, quantity: int):
        """Assemble complete cars."""
        print(f"Assembling {quantity} {car_model} cars")
        return True


class SalesDepartment:
    """Handles car sales."""
    
    def process_sale(self, car_model: str, quantity: int):
        """Process car sales."""
        print(f"Processing sale of {quantity} {car_model} cars")
        return True


# Example usage
if __name__ == "__main__":
    # Create a production line
    production_line = ProductionLine("Toyota Factory", 1000)
    
    # Run production
    success = production_line.run_full_production("Corolla", 50)
    
    if success:
        print("Production completed successfully!")
    else:
        print("Production failed!")
