"""
Car Production Workflow - Test for verifying subgraph creation
"""
class CarDesign:
    """Represents the design specifications for a car"""
    
    def __init__(self, model: str, color: str, features: list):
        self.model = model
        self.color = color
        self.features = features
        print(f"Design created for {model} in {color}")
    
    def get_specifications(self):
        """Return design specifications"""
        return {
            'model': self.model,
            'color': self.color,
            'features': self.features
        }


class CarChassis:
    """Represents the car's chassis/frame"""
    
    def __init__(self, material: str, weight: float):
        self.material = material
        self.weight = weight
        print(f"Chassis mounted with {material} material")
    
    def get_weight(self):
        return self.weight


class CarEngine:
    """Represents the car's engine"""
    
    def __init__(self, horsepower: int, fuel_type: str):
        self.horsepower = horsepower
        self.fuel_type = fuel_type
        print(f"Engine mounted with {horsepower} HP ({fuel_type})")
    
    def start(self):
        print("Engine started successfully")
        return True


class MountingProcess:
    """Handles the mounting/assembly process"""
    
    def __init__(self, design: CarDesign):
        self.design = design
        self.chassis = None
        self.engine = None
    
    def mount_chassis(self) -> CarChassis:
        """Mount the car chassis"""
        specs = self.design.get_specifications()
        self.chassis = CarChassis(
            material="Steel",
            weight=1500.0
        )
        return self.chassis
    
    def mount_engine(self, horsepower: int = 200) -> CarEngine:
        """Mount the car engine"""
        self.engine = CarEngine(
            horsepower=horsepower,
            fuel_type="Gasoline"
        )
        return self.engine
    
    def complete_mounting(self):
        """Complete the mounting process"""
        print(f"Mounting completed for {self.design.model}")
        return self.chassis is not None and self.engine is not None


class ProductionLine:
    """Manages the entire car production pipeline"""
    
    def __init__(self):
        self.design = None
        self.mounting = None
    
    def design_car(self, model: str, color: str, features: list) -> CarDesign:
        """Step 1: Design the car"""
        print("\n=== DESIGN PHASE ===")
        self.design = CarDesign(model, color, features)
        return self.design
    
    def mount_car(self) -> MountingProcess:
        """Step 2: Mount the car components"""
        print("\n=== MOUNTING PHASE ===")
        if self.design is None:
            raise ValueError("Design must be created first")
        
        mounting = MountingProcess(self.design)
        mounting.mount_chassis()
        mounting.mount_engine(horsepower=250)
        self.mounting = mounting
        return mounting
    
    def run_full_production(self):
        """Run the complete production pipeline"""
        print("\n\n======================================")
        print("STARTING CAR PRODUCTION PIPELINE")
        print("======================================\n")
        
        # Design
        self.design_car(
            model="Luxury Sedan 2024",
            color="Metallic Blue",
            features=["GPS Navigation", "Leather Seats", "Sunroof"]
        )
        
        # Mount
        self.mount_car()
        
        print("\n======================================")
        print("PRODUCTION PIPELINE COMPLETED")
        print("======================================\n")
        
        return True


# Run the production pipeline
if __name__ == "__main__":
    production_line = ProductionLine()
    production_line.run_full_production()
