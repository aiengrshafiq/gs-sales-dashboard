import json, os
from datetime import datetime, timedelta
import pandas as pd
from google.oauth2.service_account import Credentials
from gspread_pandas import Spread
from .settings import settings

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]

_cache_df = None
_cache_ts = None

def load_projects_df(force: bool = False) -> pd.DataFrame:
    """Reads the 'Projects' worksheet and normalizes dtypes."""
    sp = _spread()
    df = sp.sheet_to_df(sheet="Projects", index=None)

    # Dates
    for col in ["Start Date", "Planned Completion Date", "Forecast Completion Date"]:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors="coerce")

    # Numerics
    num_cols = ["Total Value","Progress %","CPI","SPI","Variance Days",
                "Change Orders Value","Invoices Issued","Invoices Collected","Outstanding AR"]
    for c in num_cols:
        if c in df.columns:
            df[c] = pd.to_numeric(df[c], errors="coerce").fillna(0)

    # Text normalization
    for c in ["Status","Risk Level","Health","Project Location","Client Name","Contract Type","Project Manager"]:
        if c in df.columns:
            df[c] = df[c].astype(str).str.strip().str.title()

    return df
    
def _creds_dict():
    if settings.GCP_CREDENTIALS_JSON:
        return json.loads(settings.GCP_CREDENTIALS_JSON)
    path = settings.GCP_CREDS_FILE_PATH
    if not path or not os.path.exists(path):
        raise FileNotFoundError("Set GCP_CREDENTIALS_JSON or GCP_CREDS_FILE_PATH")
    with open(path, "r") as f:
        return json.load(f)

def _spread():
    creds = Credentials.from_service_account_info(_creds_dict(), scopes=SCOPES)
    return Spread(settings.GOOGLE_SHEET_NAME, creds=creds)

def _normalize_money(s):
    s = s.astype(str).str.replace(r"[$,]", "", regex=True).str.strip()
    return pd.to_numeric(s, errors="coerce").fillna(0.0)

def _to_dt(s):
    # Parse as UTC, then drop timezone so everything is tz-naive
    return pd.to_datetime(s, errors="coerce", utc=True).dt.tz_convert("UTC").dt.tz_localize(None)

def load_df(force: bool = False) -> pd.DataFrame:
    global _cache_df, _cache_ts

    if not force and _cache_df is not None and _cache_ts and \
       datetime.utcnow() - _cache_ts < timedelta(seconds=settings.CACHE_SECONDS):
        return _cache_df

    sp = _spread()
    df = sp.sheet_to_df(sheet=settings.GOOGLE_WORKSHEET_NAME, index=None)

    # Date columns
    for col in [
        "Date Of Issuance Of Design Policy",
        "Date Of Signing Of Design Policy",
        "Final Presentation Schedule Date",
        "First Presentation Schedule Date",
        "Main Contract Signing Date",
    ]:
        if col in df.columns:
            df[col] = _to_dt(df[col])

    # Amounts
    if "Project Value" in df.columns:
        df["Project Value"] = _normalize_money(df["Project Value"])
    else:
        df["Project Value"] = 0.0

    if "Design Policy Amount" in df.columns:
        df["Design Policy Amount"] = _normalize_money(df["Design Policy Amount"])
    else:
        df["Design Policy Amount"] = 0.0

    # Clean categorical
    for col in [
        "Status",
        "Status (META Contract)",
        "Project Location",
        "Strategic Innvovaion Partner",
        "Client Name",
    ]:
        if col in df.columns:
            df[col] = (
                df[col]
                .astype(str)
                .str.strip()
                .replace({"": "Unknown", "nan": "Unknown", "None": "Unknown"})
                .str.title()
            )
        else:
            df[col] = "Unknown"

    # Cycle days (use provided column if exists else compute)
    num_col = "Number Of Days From Signing Of Design Policy To Final Presentation"
    # Try both cases (your sheet header may have the long sentence)
    if num_col not in df.columns:
        num_col = "Number of Days from Signing of Design Policy to Final Presentation"
    if num_col in df.columns:
        df[num_col] = pd.to_numeric(df[num_col], errors="coerce")
    else:
        if "Final Presentation Schedule Date" in df.columns and "Date Of Signing Of Design Policy" in df.columns:
            df[num_col] = (df["Final Presentation Schedule Date"] - df["Date Of Signing Of Design Policy"]).dt.days
        else:
            df[num_col] = pd.NA

    _cache_df, _cache_ts = df, datetime.utcnow()
    return df
