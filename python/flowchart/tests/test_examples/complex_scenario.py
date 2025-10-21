"""
Complex scenario test case for debugging flowchart generation.
This tests multiple classes, method calls, and nested scenarios.
"""

class Database:
    def __init__(self, name):
        self.name = name
        self.connected = False
        print(f"Database {name} created")
    
    def connect(self):
        self.connected = True
        print(f"Connected to {self.name}")
        return True
    
    def query(self, sql):
        if not self.connected:
            print("Not connected to database")
            return None
        print(f"Executing query: {sql}")
        return f"Result from {self.name}"

class UserService:
    def __init__(self, db):
        self.db = db
        print("UserService initialized")
    
    def get_user(self, user_id):
        print(f"Getting user {user_id}")
        if not self.db.connected:
            self.db.connect()
        return self.db.query(f"SELECT * FROM users WHERE id = {user_id}")
    
    def create_user(self, username):
        print(f"Creating user {username}")
        if not self.db.connected:
            self.db.connect()
        return self.db.query(f"INSERT INTO users (name) VALUES ('{username}')")

class AuthService:
    def __init__(self, user_service):
        self.user_service = user_service
        print("AuthService initialized")
    
    def authenticate(self, user_id):
        print(f"Authenticating user {user_id}")
        user = self.user_service.get_user(user_id)
        if user:
            print("Authentication successful")
            return True
        else:
            print("Authentication failed")
            return False

# Test the complex scenario
db = Database("main_db")
user_service = UserService(db)
auth_service = AuthService(user_service)

# Test method calls
user_service.get_user(123)
user_service.create_user("john_doe")
auth_service.authenticate(123)
