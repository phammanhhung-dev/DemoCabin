import os
from pydantic_settings import BaseSettings
from typing import List
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseSettings):
    PROJECT_NAME: str = "Cabin AI"
    API_V1_STR: str = "/api/v1"
    
    # Security
    SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "your_super_secret_key_here")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")
    
    # External APIs
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    SONIOX_API_KEY: str = os.getenv("SONIOX_API_KEY", "")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite-preview")
    
    # Payment MoMo
    MOMO_PARTNER_CODE: str = os.getenv("MOMO_PARTNER_CODE", "")
    MOMO_ACCESS_KEY: str = os.getenv("MOMO_ACCESS_KEY", "")
    MOMO_SECRET_KEY: str = os.getenv("MOMO_SECRET_KEY", "")
    MOMO_ENDPOINT: str = os.getenv("MOMO_ENDPOINT", "https://test-payment.momo.vn/v2/gateway/api/create")
    
    # Payment ZaloPay
    ZALOPAY_APP_ID: str = os.getenv("ZALOPAY_APP_ID", "")
    ZALOPAY_KEY1: str = os.getenv("ZALOPAY_KEY1", "")
    ZALOPAY_KEY2: str = os.getenv("ZALOPAY_KEY2", "")
    ZALOPAY_ENDPOINT: str = os.getenv("ZALOPAY_ENDPOINT", "https://sb-openapi.zalopay.vn/v2/create")
    
    # URLs
    BASE_URL: str = os.getenv("BASE_URL", "http://localhost:8000")
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:3000")
    
    # Email
    SMTP_HOST: str = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "465"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASS: str = os.getenv("SMTP_PASS", "")
    SMTP_FROM: str = os.getenv("SMTP_FROM", "")
    
    # Billing
    BILLING_DEBIT: bool = os.getenv("BILLING_DEBIT", "1") == "1"
    BILLING_ENFORCE: bool = os.getenv("BILLING_ENFORCE", "1") == "1"

    class Config:
        case_sensitive = True

settings = Settings()
