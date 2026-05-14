import os

from dotenv import load_dotenv

load_dotenv()


class TPSettings:
    SONIOX_API_KEY: str = os.getenv("SONIOX_API_KEY", "")
    GOOGLE_TTS_API_KEY: str = os.getenv("GOOGLE_TTS_API_KEY", "")


settings = TPSettings()
