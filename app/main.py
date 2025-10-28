from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import os
from datetime import datetime
# from .sheets import load_df
from .sheets import load_df, load_projects_df
import pandas as pd
from .metrics import (
    kpis, by_status_value, by_partner_value, by_location_value,
    monthly_totals, calendar_issuance_counts, cycle_time_distribution
)

from .metrics_projects import (
    proj_kpis, value_by_status as pj_value_by_status, value_by_location as pj_value_by_location,
    top_clients as pj_top_clients, health_breakdown as pj_health_breakdown,
    schedule_buckets as pj_schedule_buckets, monthly_starts as pj_monthly_starts,
    raw_projects as pj_raw
)

#app = FastAPI(title="Design Policy Dashboard")

#from fastapi import FastAPI, Request
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import ORJSONResponse

app = FastAPI(title="Design Policy Dashboard", default_response_class=ORJSONResponse)
app.add_middleware(GZipMiddleware, minimum_size=500)

app.mount("/static", StaticFiles(directory="app/static"), name="static")
templates = Jinja2Templates(directory="app/templates")


@app.get("/api/health")
def health():
    return {"ok": True}
    
@app.on_event("startup")
def warm():
    try:
        load_df(force=True)
    except Exception as e:
        print("Warm sales failed:", e)
    try:
        load_projects_df()  # no force; still populates cache on first call
    except Exception as e:
        print("Warm projects failed:", e)

@app.get("/", response_class=HTMLResponse)
def home(request: Request):
    
    # return templates.TemplateResponse("index.html", {"request": request})
    return templates.TemplateResponse(
        "coming_soon.html",
        {
            "request": request,
            "page_title": "Metaforge — Coming Soon",
            "brand_name": "Metaforge",
            "headline": "Something powerful is almost here",
            "subheadline": "We’re polishing the experience. Drop your email to get first access.",
            # Use an ISO date string (UTC recommended) for the countdown:
            "target_date": "2025-12-31T23:59:59Z",
            "contact_email": "hello@metaforge.global",
            "year": datetime.utcnow().year,
            # To hide the form, set show_form to False
            "show_form": True,
        },
    )

@app.get("/v2", response_class=HTMLResponse)
def v2(request: Request):
    return templates.TemplateResponse("index_v2.html", {"request": request})

@app.get("/project", response_class=HTMLResponse)
def project_v1(request: Request):
    return templates.TemplateResponse("project_v1.html", {"request": request})

@app.get("/project/v2", response_class=HTMLResponse)
def project_v2(request: Request):
    return templates.TemplateResponse("project_v2.html", {"request": request})

@app.get("/api/kpis")
def api_kpis(): return kpis()

@app.get("/api/by-status")
def api_status(): return by_status_value()

@app.get("/api/by-partner")
def api_partner(): return by_partner_value()

@app.get("/api/by-location")
def api_location(): return by_location_value()

@app.get("/api/monthly-totals")
def api_monthly(): return monthly_totals()

@app.get("/api/calendar-issuance")
def api_calendar(): return calendar_issuance_counts()

@app.get("/api/cycle-buckets")
def api_cycle(): return cycle_time_distribution()

@app.get("/api/raw")
def api_raw():
    df = load_df()
    # normalize to JSON-friendly values (ISO date strings, numbers)
    def fmt_date(s):
        return None if pd.isna(s) else pd.Timestamp(s).date().isoformat()
    payload = []
    for _, r in df.iterrows():
        payload.append({
            "issuance_date": fmt_date(r.get("Date Of Issuance Of Design Policy")),
            "signing_date": fmt_date(r.get("Date Of Signing Of Design Policy")),
            "client": r.get("Client Name"),
            "location": r.get("Project Location"),
            "design_policy_amount": float(r.get("Design Policy Amount", 0) or 0),
            "final_presentation_date": fmt_date(r.get("Final Presentation Schedule Date")),
            "project_value": float(r.get("Project Value", 0) or 0),
            "first_presentation_date": fmt_date(r.get("First Presentation Schedule Date")),
            "cycle_days": (None if pd.isna(r.get("Number Of Days From Signing Of Design Policy To Final Presentation", None))
                           else int(r.get("Number Of Days From Signing Of Design Policy To Final Presentation"))),
            "status": r.get("Status"),
            "comments": r.get("Comments"),
            "partner": r.get("Strategic Innvovaion Partner"),
            "main_contract_date": fmt_date(r.get("Main Contract Signing Date")),
            "meta_status": r.get("Status (META Contract)"),
        })
    return {"rows": payload}



#projects metrics API
@app.get("/api/projects/kpis")
def api_proj_kpis(): return proj_kpis()

@app.get("/api/projects/raw")
def api_proj_raw(): return pj_raw()

@app.get("/api/projects/by-status")
def api_proj_by_status(): return pj_value_by_status()

@app.get("/api/projects/by-location")
def api_proj_by_location(): return pj_value_by_location()

@app.get("/api/projects/top-clients")
def api_proj_top_clients(): return pj_top_clients()

@app.get("/api/projects/health")
def api_proj_health(): return pj_health_breakdown()

@app.get("/api/projects/schedule-buckets")
def api_proj_sched(): return pj_schedule_buckets()

@app.get("/api/projects/monthly-starts")
def api_proj_months(): return pj_monthly_starts()