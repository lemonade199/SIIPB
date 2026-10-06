"""Application configuration loaded from environment / .env."""
import os

from dotenv import load_dotenv

load_dotenv()

DATABASE_URL: str = os.environ.get(
    "DATABASE_URL",
    "mariadb+pymysql://root@127.0.0.1:3306/siipb?charset=utf8mb4",
)
