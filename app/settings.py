import os
from dotenv import load_dotenv

# Load .env as early as possible
load_dotenv()

class Settings:
    GOOGLE_SHEET_NAME = os.getenv("GOOGLE_SHEET_NAME", "Design Agreement Status")
    GOOGLE_WORKSHEET_NAME = os.getenv("GOOGLE_WORKSHEET_NAME", "SIPTracker")
    GCP_CREDENTIALS_JSON = os.getenv("GCP_CREDENTIALS_JSON")     # optional (env JSON string)
    GCP_CREDS_FILE_PATH = os.getenv("GCP_CREDS_FILE_PATH")       # file path fallback
    CACHE_SECONDS = int(os.getenv("CACHE_SECONDS", "180"))

settings = Settings()
