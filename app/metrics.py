from typing import Dict, Any
import pandas as pd
from .sheets import load_df

NUM_CYCLE_COLS = [
    "Number Of Days From Signing Of Design Policy To Final Presentation",
    "Number of Days from Signing of Design Policy to Final Presentation",
]

def _cycle_col(df):
    for c in NUM_CYCLE_COLS:
        if c in df.columns:
            return c
    return None

def kpis() -> Dict[str, Any]:
    df = load_df()
    total_project_value = float(df["Project Value"].sum())
    total_design_policy = float(df["Design Policy Amount"].sum())

    signed_mask = df["Status (META Contract)"].isin(["Won", "Lost", "In Progress"])
    won = int((df["Status (META Contract)"] == "Won").sum())
    total_signed = int(signed_mask.sum())
    win_rate = round((won / total_signed * 100.0), 1) if total_signed else 0.0

    cycle_col = _cycle_col(df)
    avg_cycle = float(df[cycle_col].dropna().mean()) if cycle_col else 0.0

    upcoming = 0
    col = "Final Presentation Schedule Date"
    if col in df.columns:
        # Ensure datetime dtype (whatever came from Sheets)
        s = pd.to_datetime(df[col], errors="coerce")

        # Compare using pure dates (no tz headaches)
        today = pd.Timestamp.utcnow().date()
        soon = (pd.Timestamp.utcnow() + pd.Timedelta(days=14)).date()

        s_dates = s.dt.date
        upcoming = ((s_dates >= today) & (s_dates <= soon)).sum()

    return {
        "total_project_value": round(total_project_value, 2),
        "total_design_policy": round(total_design_policy, 2),
        "win_rate": win_rate,
        "avg_cycle_days": round(avg_cycle, 1),
        "upcoming_presentations_14d": int(upcoming),
        "total_records": int(len(df)),
    }

def by_status_value():
    df = load_df()
    s = df.groupby("Status (META Contract)")["Project Value"].sum().sort_values(ascending=False)
    return [{"status": k, "value": float(v)} for k, v in s.items()]

def by_partner_value(top: int = 10):
    df = load_df()
    s = df.groupby("Strategic Innvovaion Partner")["Project Value"].sum().sort_values(ascending=False).head(top)
    return [{"partner": k, "value": float(v)} for k, v in s.items()]

def by_location_value():
    df = load_df()
    s = df.groupby("Project Location")["Project Value"].sum().sort_values(ascending=False)
    return [{"location": k, "value": float(v)} for k, v in s.items()]

def monthly_totals():
    df = load_df()
    col = "Date Of Issuance Of Design Policy"
    if col not in df.columns:
        return {"labels": [], "values": []}
    d = df.dropna(subset=[col]).copy()
    d["month"] = d[col].dt.to_period("M").astype(str)
    s = d.groupby("month")["Project Value"].sum().sort_index()
    return {"labels": list(s.index), "values": [float(x) for x in s.values]}

def calendar_issuance_counts():
    df = load_df()
    col = "Date Of Issuance Of Design Policy"
    if col not in df.columns:
        return []
    d = df.dropna(subset=[col])
    s = d.groupby(d[col].dt.date)["Client Name"].count()
    return [[str(k), int(v)] for k, v in s.items()]

def cycle_time_distribution():
    df = load_df()
    col = _cycle_col(df)
    if not col:
        return []
    ser = df[col].dropna().astype(int)
    bins = pd.cut(ser, bins=[-1,7,14,21,30,45,60,90,9999],
                  labels=["≤7","8-14","15-21","22-30","31-45","46-60","61-90",">90"])
    s = bins.value_counts().reindex(["≤7","8-14","15-21","22-30","31-45","46-60","61-90",">90"], fill_value=0)
    return [{"bucket": idx, "count": int(val)} for idx, val in s.items()]
