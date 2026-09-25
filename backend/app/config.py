import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    APP_NAME: str = os.getenv("APP_NAME", "Equilibrium API")
    APP_ENV: str = os.getenv("APP_ENV", "development")
    BACKEND_PORT: int = int(os.getenv("BACKEND_PORT", "8000"))
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5173")

settings = Config()
