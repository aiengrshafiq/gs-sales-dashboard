# app/metrics_projects.py
from typing import Dict, Any, List
import pandas as pd
from .sheets import load_projects_df

def proj_kpis() -> Dict[str, Any]:
    df = load_projects_df()

    portfolio_value = float(df["Total Value"].sum())

    in_progress = int(df[df["Status"].isin(["Planning","Executing"])].shape[0])

    # On-time = Forecast <= Planned (only where both exist)
    d = df.dropna(subset=["Planned Completion Date","Forecast Completion Date"]).copy()
    on_time = int((d["Forecast Completion Date"] <= d["Planned Completion Date"]).sum())
    on_time_rate = round((on_time / len(d) * 100) if len(d) else 0.0, 1)

    avg_progress = round(float(df["Progress %"].mean() if "Progress %" in df else 0.0), 1)
    avg_cpi = round(float(df["Cpi"].mean()) if "Cpi" in df.columns else float(df["CPI"].mean()), 2) if "CPI" in df else 0.0
    avg_spi = round(float(df["Spi"].mean()) if "Spi" in df.columns else float(df["SPI"].mean()), 2) if "SPI" in df else 0.0

    outstanding_ar = float(df["Outstanding AR"].sum()) if "Outstanding AR" in df else 0.0

    at_risk = int(df[df["Health"].isin(["Red","Amber"])].shape[0])

    return {
        "portfolio_value": round(portfolio_value, 2),
        "in_progress": in_progress,
        "on_time_rate": on_time_rate,
        "avg_progress": avg_progress,
        "avg_cpi": avg_cpi,
        "avg_spi": avg_spi,
        "outstanding_ar": round(outstanding_ar, 2),
        "at_risk": at_risk,
        "total_projects": int(len(df)),
    }

def value_by_status():
    df = load_projects_df()
    s = df.groupby("Status")["Total Value"].sum().sort_values(ascending=False)
    return [{"status": k, "value": float(v)} for k, v in s.items()]

def value_by_location():
    df = load_projects_df()
    s = df.groupby("Project Location")["Total Value"].sum().sort_values(ascending=False)
    return [{"location": k, "value": float(v)} for k, v in s.items()]

def top_clients(n=10):
    df = load_projects_df()
    s = df.groupby("Client Name")["Total Value"].sum().sort_values(ascending=False).head(n)
    return [{"client": k, "value": float(v)} for k, v in s.items()]

def health_breakdown():
    df = load_projects_df()
    s = df.groupby("Health")["Project Code"].count().reindex(["Green","Amber","Red"], fill_value=0)
    return [{"health": idx, "count": int(val)} for idx, val in s.items()]

def schedule_buckets():
    df = load_projects_df()
    ser = df["Variance Days"].fillna(0).astype(int)
    bins = pd.cut(ser, bins=[-9999,-16,-1,0,15,30,60,9999], labels=["≤-16","-15..-1","0","+1..15","+16..30","+31..60",">60"])
    s = bins.value_counts().reindex(["≤-16","-15..-1","0","+1..15","+16..30","+31..60",">60"], fill_value=0)
    return [{"bucket": idx, "count": int(val)} for idx, val in s.items()]

def monthly_starts():
    df = load_projects_df()
    d = df.dropna(subset=["Start Date"]).copy()
    d["month"] = d["Start Date"].dt.to_period("M").astype(str)
    s = d.groupby("month")["Project Code"].count().sort_index()
    return {"labels": list(s.index), "values": [int(x) for x in s.values]}

def raw_projects():
    df = load_projects_df()
    out = []
    for _, r in df.iterrows():
        out.append({
            "code": r.get("Project Code"),
            "name": r.get("Project Name"),
            "client": r.get("Client Name"),
            "location": r.get("Project Location"),
            "type": r.get("Contract Type"),
            "pm": r.get("Project Manager"),
            "value": float(r.get("Total Value", 0) or 0),
            "start": (None if pd.isna(r.get("Start Date")) else pd.Timestamp(r["Start Date"]).date().isoformat()),
            "planned_finish": (None if pd.isna(r.get("Planned Completion Date")) else pd.Timestamp(r["Planned Completion Date"]).date().isoformat()),
            "forecast_finish": (None if pd.isna(r.get("Forecast Completion Date")) else pd.Timestamp(r["Forecast Completion Date"]).date().isoformat()),
            "status": r.get("Status"),
            "progress": float(r.get("Progress %", 0) or 0),
            "cpi": float(r.get("CPI", 0) or 0),
            "spi": float(r.get("SPI", 0) or 0),
            "risk": r.get("Risk Level"),
            "health": r.get("Health"),
            "variance_days": int(r.get("Variance Days", 0) or 0),
            "co_value": float(r.get("Change Orders Value", 0) or 0),
            "inv_issued": float(r.get("Invoices Issued", 0) or 0),
            "inv_collected": float(r.get("Invoices Collected", 0) or 0),
            "ar_outstanding": float(r.get("Outstanding AR", 0) or 0),
        })
    return {"rows": out}
