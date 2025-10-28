"""
Test IF statement connections
"""
class TestClass:
    def mount_car(self):
        """Test method with IF statement"""
        if self.design is None:
            raise ValueError('Design must be created first')
        
        mounting = MountingProcess(self.design)
        return mounting

